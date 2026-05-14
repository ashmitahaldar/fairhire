import { Router } from 'express';
import { z } from 'zod';
import { withManagerContext } from '../lib/prisma';
import { requireOwnership } from '../middleware/requireOwnership';

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

  const meeting = await withManagerContext(req.manager.id, async (tx) => {
    return tx.meeting.create({
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
  });

  res.status(201).json(meeting);
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
