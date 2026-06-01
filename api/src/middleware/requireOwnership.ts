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
