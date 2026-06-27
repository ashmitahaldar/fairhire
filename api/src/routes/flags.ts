import { Router } from 'express';
import { z } from 'zod';
import { withManagerContext } from '../lib/prisma';
import { requireOwnership } from '../middleware/requireOwnership';

export const flagsRouter = Router();

// Set-dismissed body. Discriminated on the boolean so undoing
// (dismissed=false) doesn't need to carry a reason and dismissing
// (dismissed=true) requires one. The third branch preserves the
// pre-Week-5 shape (bare { dismissReason } means "dismiss with this
// reason") so any in-flight client that doesn't know about the new
// shape still works.
const setDismissedBody = z.union([
  z.object({ dismissed: z.literal(true), dismissReason: z.string().min(1) }),
  z.object({ dismissed: z.literal(false) }),
  z.object({ dismissReason: z.string().min(1) }).transform((v) => ({
    dismissed: true as const,
    dismissReason: v.dismissReason,
  })),
]);

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

// PATCH /flags/:id — set or clear the dismissed state for a flag the
// caller owns. Both directions write to the same row so a flag's
// dismissal history isn't recoverable through this endpoint — for
// audit, the timestamps + actor are kept for the most recent action.
flagsRouter.patch('/:id', requireOwnership('flag'), async (req, res) => {
  const parsed = setDismissedBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const flag = await withManagerContext(req.manager.id, async (tx) => {
    if (parsed.data.dismissed) {
      return tx.flag.update({
        where: { id: req.params.id },
        data: {
          dismissed: true,
          dismissReason: parsed.data.dismissReason,
          dismissedAt: new Date(),
          dismissedBy: req.manager.id,
        },
      });
    }
    return tx.flag.update({
      where: { id: req.params.id },
      data: {
        dismissed: false,
        dismissReason: null,
        dismissedAt: null,
        dismissedBy: null,
      },
    });
  });

  res.json(flag);
});
