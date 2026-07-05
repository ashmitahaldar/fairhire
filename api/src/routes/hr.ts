import { Router } from 'express';
import { z } from 'zod';
import { MIRROR_PERIODS } from '@fairhire/shared';
import { withManagerContext } from '../lib/prisma';
import { requireRole } from '../middleware/requireRole';
import {
  aggregateHrDecisions,
  aggregateHrDemographics,
  aggregateHrFlags,
  aggregateHrNudges,
} from '../hr/aggregator';

export const hrRouter = Router();

// Every /hr endpoint is HR-admin only. The role gate is enforced here, not
// just by hiding the nav link — a regular manager hitting these directly gets
// a 403.
hrRouter.use(requireRole('hr_admin'));

// Period filtering matches the Pattern Mirror (30d/90d/12m, default 90d).
const querySchema = z.object({
  period: z.enum(MIRROR_PERIODS).default('90d'),
});

// All three handlers read the org-level SECURITY DEFINER aggregate functions
// (prisma/manual/005_hr_aggregates.sql) INSIDE withManagerContext so the
// session's current_manager_id() resolves — this is what scopes the functions
// to the caller's org, and also what fixes the prior bug where the route
// queried app_user without context and RLS returned all zeros.
//
// The functions expose only aggregate columns, so no individual manager's
// rows, flag excerpts, or reasoning can be returned from this namespace.

hrRouter.get('/flags', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const data = await withManagerContext(req.manager.id, (tx) =>
    aggregateHrFlags(tx, parsed.data.period),
  );
  res.json(data);
});

hrRouter.get('/decisions', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const data = await withManagerContext(req.manager.id, (tx) =>
    aggregateHrDecisions(tx, parsed.data.period),
  );
  res.json(data);
});

hrRouter.get('/demographics', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const data = await withManagerContext(req.manager.id, (tx) =>
    aggregateHrDemographics(tx, parsed.data.period),
  );
  res.json(data);
});

// Org-level reflections derived from the aggregates above (no new SQL). Same
// role gate + period scoping; the response carries only templated sentences
// built from org counts — no manager identity, candidate, or excerpt.
hrRouter.get('/nudges', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const data = await withManagerContext(req.manager.id, (tx) =>
    aggregateHrNudges(tx, parsed.data.period),
  );
  res.json(data);
});
