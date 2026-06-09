import { Request, Response, NextFunction } from 'express';
import { systemPrisma } from '../lib/prisma';

// Ownership checks run BEFORE the manager context is established for the
// handler — they ARE the authorisation gate, not subject to RLS. Use
// systemPrisma (RLS-bypassing) so the lookup can see the row at all; the
// managerId comparison below is what enforces access.

type OwnershipCheck = (req: Request) => Promise<boolean>;

const checks: Record<string, OwnershipCheck> = {
  meeting: async (req) => {
    const meeting = await systemPrisma.meeting.findUnique({
      where: { id: req.params.id },
      select: { managerId: true },
    });
    return meeting?.managerId === req.manager.id;
  },

  decision: async (req) => {
    const decision = await systemPrisma.decision.findUnique({
      where: { id: req.params.id },
      select: { managerId: true },
    });
    return decision?.managerId === req.manager.id;
  },

  flag: async (req) => {
    const flag = await systemPrisma.flag.findUnique({
      where: { id: req.params.id },
      select: { meeting: { select: { managerId: true } } },
    });
    return flag?.meeting?.managerId === req.manager.id;
  },

  // Hybrid access for candidates: the candidates list is org-scoped (any
  // manager in the org sees every candidate) but writes are gated to
  // candidates the caller has actually interviewed. The check passes only
  // if at least one MeetingCandidate row links this candidate to a meeting
  // owned by req.manager AND the candidate is still active (deletedAt: null
  // — writes on tombstoned candidates are refused). Returns 403 in all
  // failure cases (missing candidate, soft-deleted candidate, not-yet-
  // interviewed) so existence isn't leaked.
  candidate: async (req) => {
    const link = await systemPrisma.meetingCandidate.findFirst({
      where: {
        candidateId: req.params.id,
        // Belt-and-braces: even if a caller passes a candidate id from
        // another org, the relation filter refuses. The RLS UPDATE policy
        // (001_rls.sql) is the primary defence; this is the secondary one.
        candidate: { deletedAt: null, orgId: req.manager.orgId },
        meeting: { managerId: req.manager.id },
      },
      select: { meetingId: true },
    });
    return link !== null;
  },
};

export function requireOwnership(resource: keyof typeof checks) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const check = checks[resource];
    if (!check) {
      next();
      return;
    }

    const owned = await check(req);
    if (!owned) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
