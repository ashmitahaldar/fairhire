import { Router } from 'express';
import { z } from 'zod';
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

// Minimal create — name + role only. Demographics are deferred to a follow-up
// (the eval/fairness slice degrades gracefully on missing demographics; they
// can be added via Prisma Studio in the meantime).
const createBody = z.object({
  name: z.string().trim().min(1).max(255),
  roleAppliedFor: z.string().trim().min(1).max(255),
});

candidatesRouter.post('/', async (req, res) => {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { name, roleAppliedFor } = parsed.data;

  const candidate = await withManagerContext(req.manager.id, async (tx) => {
    return tx.candidate.create({
      data: { name, roleAppliedFor, orgId: req.manager.orgId },
      select: { id: true, name: true, roleAppliedFor: true },
    });
  });

  res.status(201).json(candidate);
});
