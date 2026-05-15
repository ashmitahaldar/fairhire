import { Router } from 'express';
import { z } from 'zod';
import { withManagerContext } from '../lib/prisma';
import { requireOwnership } from '../middleware/requireOwnership';

export const flagsRouter = Router();

const dismissBody = z.object({
  dismissReason: z.string().min(1),
});

const listQuery = z.object({
  meetingId: z.string().uuid().optional(),
});

flagsRouter.get('/', async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { meetingId } = parsed.data;

  const flags = await withManagerContext(req.manager.id, async (tx) => {
    return tx.flag.findMany({
      where: {
        meeting: { managerId: req.manager.id },
        ...(meetingId ? { meetingId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  });
  res.json(flags);
});

// PATCH /flags/:id — dismiss a flag with a mandatory reason
flagsRouter.patch('/:id', requireOwnership('flag'), async (req, res) => {
  const parsed = dismissBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const flag = await withManagerContext(req.manager.id, async (tx) => {
    return tx.flag.update({
      where: { id: req.params.id },
      data: {
        dismissed: true,
        dismissReason: parsed.data.dismissReason,
        dismissedAt: new Date(),
        dismissedBy: req.manager.id,
      },
    });
  });

  res.json(flag);
});
