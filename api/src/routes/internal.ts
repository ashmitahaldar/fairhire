import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { FLAG_TYPES } from '@fairhire/shared';
import { prisma, withManagerContext } from '../lib/prisma';

export const internalRouter = Router();

function requireInternalSecret(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers['x-internal-secret'];
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

internalRouter.use(requireInternalSecret);

const flagInput = z.object({
  flagType: z.enum(FLAG_TYPES),
  excerpt: z.string().min(1),
  reasoning: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
  suggestedAlt: z.string().optional(),
});

const resultsBody = z.object({
  flags: z.array(flagInput),
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

  const run = await prisma.analysisRun.findUnique({
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

  // Idempotency guard: a terminal run must not accept a second result set,
  // otherwise flags get written twice (e.g. in-process pipeline already ran).
  if (run.status === 'completed' || run.status === 'failed') {
    res.status(409).json({ error: `AnalysisRun already ${run.status}` });
    return;
  }

  const { flags, modelVersion } = parsed.data;
  const orgId = run.meeting.orgId;

  await withManagerContext(run.meeting.managerId, async (tx) => {
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

    await tx.analysisRun.update({
      where: { id: req.params.runId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        ...(modelVersion ? { modelVersion } : {}),
      },
    });
  });

  res.json({ ok: true, flagsWritten: flags.length });
});
