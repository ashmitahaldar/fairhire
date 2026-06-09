import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { withManagerContext } from '../lib/prisma';
import { requireOwnership } from '../middleware/requireOwnership';

export const decisionsRouter = Router();

const createBody = z.object({
  meetingId: z.string().uuid(),
  candidateId: z.string().uuid(),
  outcome: z.enum(['hired', 'rejected', 'in_progress']).default('in_progress'),
  notes: z.string().optional(),
});

const updateBody = z.object({
  outcome: z.enum(['hired', 'rejected', 'in_progress']).optional(),
  notes: z.string().optional(),
});

decisionsRouter.get('/', async (req, res) => {
  const decisions = await withManagerContext(req.manager.id, async (tx) => {
    return tx.decision.findMany({
      where: { managerId: req.manager.id },
      include: {
        candidate: { include: { demographics: true } },
        meeting: { select: { id: true, title: true, date: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });
  res.json(decisions);
});

decisionsRouter.post('/', async (req, res) => {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const decision = await withManagerContext(req.manager.id, async (tx) => {
      return tx.decision.create({
        data: {
          ...parsed.data,
          managerId: req.manager.id,
          orgId: req.manager.orgId,
        },
      });
    });
    res.status(201).json(decision);
  } catch (err) {
    // Unique constraint on (meetingId, candidateId) — race between two
    // panel clicks that both saw decision.id === null. Surface as 409 so
    // the client can swallow it and refetch the now-existing row instead
    // of treating it as a hard failure.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      res.status(409).json({ error: 'Decision already exists for this meeting and candidate' });
      return;
    }
    throw err;
  }
});

decisionsRouter.patch('/:id', requireOwnership('decision'), async (req, res) => {
  const parsed = updateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const decision = await withManagerContext(req.manager.id, async (tx) => {
    return tx.decision.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
  });

  res.json(decision);
});
