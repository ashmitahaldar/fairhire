import { Router, Request, Response, NextFunction } from 'express';
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

// POST /internal/analysis/:runId/results
// The analysis engine posts completed flags here. We resolve the meeting's
// manager_id and set app.current_manager_id so RLS applies correctly.
internalRouter.post('/analysis/:runId/results', async (req, res) => {
  const run = await prisma.analysisRun.findUnique({
    where: { id: req.params.runId },
    select: { meetingId: true, meeting: { select: { managerId: true } } },
  });

  if (!run) {
    res.status(404).json({ error: 'AnalysisRun not found' });
    return;
  }

  await withManagerContext(run.meeting.managerId, async (tx) => {
    // Mark run complete and write flags in a single transaction
    await tx.analysisRun.update({
      where: { id: req.params.runId },
      data: { status: 'completed', completedAt: new Date() },
    });
    // Flags written here in Week 2 when analysis engine is built
  });

  res.json({ ok: true });
});
