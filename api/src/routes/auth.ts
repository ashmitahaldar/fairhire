import { Router } from 'express';
import { getAuth } from '@clerk/express';
import { z } from 'zod';
import { clerkAuth, attachManager } from '../middleware/requireAuth';
import { systemPrisma } from '../lib/prisma';

export const authRouter = Router();

const syncBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  // Demo-only: the registrant self-selects their role at first sign-in.
  // In a real deployment this comes from an org owner / invitation, never
  // the registrant — role is a privilege boundary. Applied on create only
  // (the upsert's `update: {}` means re-syncs never change an existing role).
  role: z.enum(['manager', 'hr_admin']).optional(),
});

// POST /auth/sync
// Called by the frontend immediately after Clerk sign-in.
// Creates a Manager row on first login; returns existing row on subsequent calls.
// Uses systemPrisma so the upsert works before app.current_manager_id is set.
authRouter.post('/sync', clerkAuth, async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsed = syncBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, email, role } = parsed.data;

  // Assign to the first org and department — sufficient for Week 1 single-tenant setup.
  // A proper invitation/org-selection flow replaces this in a later week.
  const org = await systemPrisma.organisation.findFirst();
  if (!org) {
    res.status(500).json({ error: 'No organisation found — run the seed script first' });
    return;
  }

  const dept = await systemPrisma.department.findFirst({ where: { orgId: org.id } });
  if (!dept) {
    res.status(500).json({ error: 'No department found — run the seed script first' });
    return;
  }

  const manager = await systemPrisma.manager.upsert({
    where: { clerkUserId: userId },
    create: { clerkUserId: userId, name, email, orgId: org.id, deptId: dept.id, role: role ?? 'manager' },
    update: {},
    select: { id: true, name: true, email: true, role: true, orgId: true, deptId: true },
  });

  res.json(manager);
});

// GET /auth/me
// Returns the current manager's profile. Used by the frontend to check role
// and gate hr_admin routes. Requires a valid Manager row (call /sync first).
authRouter.get('/me', clerkAuth, attachManager, (req, res) => {
  const { id, name, email, role, orgId, deptId } = req.manager;
  res.json({ id, name, email, role, orgId, deptId });
});
