import { Request, Response, NextFunction } from 'express';
import type { Role } from '@fairhire/shared';

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.manager.role !== role) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
