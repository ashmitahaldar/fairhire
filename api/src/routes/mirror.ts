import { Router } from 'express';
import { z } from 'zod';
import { MEETING_TYPES, MIRROR_PERIODS } from '@fairhire/shared';
import { systemPrisma, withManagerContext } from '../lib/prisma';
import { aggregateMirror } from '../mirror/aggregator';

export const mirrorRouter = Router();

// Composite Pattern Mirror endpoint. Returns the full MirrorData shape;
// Phase A populates summary + decisions + recentDecisions, Phase B/C/D
// fields ship as empty arrays until their respective steps land. See
// Section 1 of the Week 4 plan.

const querySchema = z.object({
  // Default matches the Mirror's current period label ("Last 90 days") so
  // a bare GET /mirror returns a useful payload without the client having
  // to know the period taxonomy.
  period: z.enum(MIRROR_PERIODS).default('90d'),
  // Hiring/Promotion split (Week 5 Section 3). Default to hiring so
  // pre-Week-5 callers (and the dashboard list) keep their current
  // behaviour; the client opts in to promotion by passing the param.
  meetingType: z.enum(MEETING_TYPES).default('hiring'),
});

mirrorRouter.get('/', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { period, meetingType } = parsed.data;

  // Pulls the manager's display name + department name for the header.
  // systemPrisma is fine here: it's reading the caller's own row (already
  // authenticated by attachManager) so RLS bypass doesn't widen access.
  const managerInfo = await systemPrisma.manager.findUnique({
    where: { id: req.manager.id },
    select: { name: true, dept: { select: { name: true } } },
  });
  if (!managerInfo) {
    res.status(404).json({ error: 'Manager not found' });
    return;
  }

  const data = await withManagerContext(req.manager.id, async (tx) => {
    return aggregateMirror(tx, {
      managerId: req.manager.id,
      manager: { name: managerInfo.name, team: managerInfo.dept.name },
      period,
      meetingType,
    });
  });

  res.json(data);
});
