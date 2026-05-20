import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { systemPrisma, withManagerContext } from '../lib/prisma';
import { FlagCandidateSchema } from '../analysis/types';

export const internalRouter = Router();

// Thrown inside the write transaction when a concurrent caller has already
// finalised the run — rolls the transaction back so no flags are written.
class RunAlreadyFinalised extends Error {}

function requireInternalSecret(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers['x-internal-secret'];
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

internalRouter.use(requireInternalSecret);

const resultsBody = z.object({
  flags: z.array(FlagCandidateSchema),
  modelVersion: z.string().optional(),
});

// POST /internal/analysis/:runId/results
// External analysis engine (or future worker) posts completed flags here.
// The in-process pipeline writes directly via systemPrisma; this endpoint
// supports external callers (e.g. a separate analysis service).
internalRouter.post('/analysis/:runId/results', async (req, res) => {
  const parsed = resultsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  // This route is secret-authenticated, not Clerk — there is no manager
  // context. The RLS-enforced client would filter analysis_runs to 0 rows
  // (current_manager_id() is NULL), so use systemPrisma for the lookup, then
  // switch to withManagerContext for the write so RLS WITH CHECK still applies.
  const run = await systemPrisma.analysisRun.findUnique({
    where: { id: req.params.runId },
    select: {
      status: true,
      meetingId: true,
      meeting: { select: { managerId: true, orgId: true } },
    },
  });

  if (!run) {
    res.status(404).json({ error: 'AnalysisRun not found' });
    return;
  }

  // Fast path: a clearly-terminal run is rejected without opening a
  // transaction. This is an optimisation for late retries — NOT the
  // correctness guard (it is still a check-then-act and races). The
  // authoritative guard is the conditional claim inside the transaction below.
  if (run.status === 'completed' || run.status === 'failed') {
    res.status(409).json({ error: `AnalysisRun already ${run.status}` });
    return;
  }

  const { flags, modelVersion } = parsed.data;
  const orgId = run.meeting.orgId;

  try {
    await withManagerContext(run.meeting.managerId, async (tx) => {
      // Atomic compare-and-swap: only the caller that transitions the run out
      // of a non-terminal state may write flags. A concurrent caller's
      // updateMany matches 0 rows (the row is locked, then the predicate
      // re-evaluates to a terminal status under READ COMMITTED) → it bails
      // before inserting, so flags can never be written twice.
      const claim = await tx.analysisRun.updateMany({
        where: { id: req.params.runId, status: { in: ['pending', 'running'] } },
        data: {
          status: 'completed',
          completedAt: new Date(),
          ...(modelVersion ? { modelVersion } : {}),
        },
      });

      if (claim.count === 0) throw new RunAlreadyFinalised();

      if (flags.length > 0) {
        await tx.flag.createMany({
          data: flags.map((f) => ({
            flagType: f.flagType,
            excerpt: f.excerpt,
            reasoning: f.reasoning,
            confidenceScore: f.confidenceScore,
            suggestedAlt: f.suggestedAlt ?? null,
            meetingId: run.meetingId,
            orgId,
          })),
        });
      }
    });
  } catch (err) {
    if (err instanceof RunAlreadyFinalised) {
      res.status(409).json({ error: 'AnalysisRun already finalised' });
      return;
    }
    throw err;
  }

  res.json({ ok: true, flagsWritten: flags.length });
});
