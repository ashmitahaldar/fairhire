import { Request, Response, NextFunction } from 'express';
import type { Role } from '@fairhire/shared';

export function requireRole(role: Role) {
  return (_req: Request, res: Response, next: NextFunction) => {
    // TODO: check req.manager.role once Manager lookup is wired in Step 4
    const managerRole: Role | undefined = (_req as unknown as { manager?: { role: Role } }).manager
      ?.role;
    if (managerRole !== role) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
