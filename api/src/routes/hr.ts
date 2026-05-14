import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireRole } from '../middleware/requireRole';

export const hrRouter = Router();

hrRouter.use(requireRole('hr_admin'));

// GET /hr/summary
// Returns org-level aggregate counts only. Individual manager rows and flag
// content are never returned from this namespace — enforced here, not just RLS.
hrRouter.get('/summary', async (req, res) => {
  const orgId = req.manager.orgId;

  // All queries are aggregate — no individual rows exposed
  const [flagCounts, decisionCounts, flagsByType, decisionsByOutcome] = await Promise.all([
    prisma.$queryRaw<{ total: bigint; dismissed: bigint }[]>`
      SELECT COUNT(*)::bigint AS total,
             COUNT(*) FILTER (WHERE dismissed = true)::bigint AS dismissed
      FROM flags
      WHERE org_id = ${orgId}
    `,
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total
      FROM decisions
      WHERE org_id = ${orgId}
    `,
    prisma.$queryRaw<{ flag_type: string; count: bigint }[]>`
      SELECT flag_type, COUNT(*)::bigint AS count
      FROM flags
      WHERE org_id = ${orgId}
      GROUP BY flag_type
      ORDER BY count DESC
    `,
    prisma.$queryRaw<{ outcome: string; count: bigint }[]>`
      SELECT outcome, COUNT(*)::bigint AS count
      FROM decisions
      WHERE org_id = ${orgId}
      GROUP BY outcome
    `,
  ]);

  res.json({
    flags: {
      total: Number(flagCounts[0]?.total ?? 0),
      dismissed: Number(flagCounts[0]?.dismissed ?? 0),
      byType: flagsByType.map((r) => ({ type: r.flag_type, count: Number(r.count) })),
    },
    decisions: {
      total: Number(decisionCounts[0]?.total ?? 0),
      byOutcome: decisionsByOutcome.map((r) => ({ outcome: r.outcome, count: Number(r.count) })),
    },
  });
});
