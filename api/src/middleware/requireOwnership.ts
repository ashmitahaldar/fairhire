import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

type OwnershipCheck = (req: Request) => Promise<boolean>;

const checks: Record<string, OwnershipCheck> = {
  meeting: async (req) => {
    const meeting = await prisma.meeting.findUnique({
      where: { id: req.params.id },
      select: { managerId: true },
    });
    return meeting?.managerId === req.manager.id;
  },

  decision: async (req) => {
    const decision = await prisma.decision.findUnique({
      where: { id: req.params.id },
      select: { managerId: true },
    });
    return decision?.managerId === req.manager.id;
  },

  flag: async (req) => {
    const flag = await prisma.flag.findUnique({
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
