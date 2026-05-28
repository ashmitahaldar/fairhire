import { Router } from 'express';
import { withManagerContext } from '../lib/prisma';

export const candidatesRouter = Router();

// Org-scoped candidate list for pickers (e.g. the meeting-upload form).
// RLS scopes rows to the manager's org; only display fields are returned.
candidatesRouter.get('/', async (req, res) => {
  const candidates = await withManagerContext(req.manager.id, async (tx) => {
    return tx.candidate.findMany({
      select: { id: true, name: true, roleAppliedFor: true },
      orderBy: { name: 'asc' },
    });
  });
  res.json(candidates);
});
