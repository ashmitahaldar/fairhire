import { Router } from 'express';
import { z } from 'zod';
import { withManagerContext } from '../lib/prisma';
import { requireOwnership } from '../middleware/requireOwnership';
import { runAnalysis } from '../analysis/analyseTranscript';

export const meetingsRouter = Router();

const createBody = z.object({
  title: z.string().min(1),
  transcript: z.string().min(1),
  date: z.string().datetime(),
  candidateIds: z.array(z.string().uuid()).min(1),
});

meetingsRouter.get('/', async (req, res) => {
  const meetings = await withManagerContext(req.manager.id, async (tx) => {
    return tx.meeting.findMany({
      where: { managerId: req.manager.id },
      include: { candidates: { include: { candidate: true } } },
      orderBy: { date: 'desc' },
    });
  });
  res.json(meetings);
});

meetingsRouter.post('/', async (req, res) => {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { title, transcript, date, candidateIds } = parsed.data;

  const { meeting, runId } = await withManagerContext(req.manager.id, async (tx) => {
    const m = await tx.meeting.create({
      data: {
        title,
        transcript,
        date: new Date(date),
        managerId: req.manager.id,
        orgId: req.manager.orgId,
        candidates: {
          create: candidateIds.map((candidateId) => ({ candidateId })),
        },
      },
      include: { candidates: { include: { candidate: true } } },
    });
    const run = await tx.analysisRun.create({
      data: { meetingId: m.id, orgId: req.manager.orgId, status: 'pending' },
    });
    return { meeting: m, runId: run.id };
  });

  res.status(201).json(meeting);

  setImmediate(() => {
    runAnalysis(runId, meeting.id, transcript, req.manager.orgId).catch((err) => {
      console.error('[analysis] unhandled error for run', runId, err);
    });
  });
});

meetingsRouter.get('/:id', requireOwnership('meeting'), async (req, res) => {
  const meeting = await withManagerContext(req.manager.id, async (tx) => {
    return tx.meeting.findUnique({
      where: { id: req.params.id },
      include: {
        candidates: { include: { candidate: true } },
        flags: true,
        analysisRuns: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  });
  res.json(meeting);
});
