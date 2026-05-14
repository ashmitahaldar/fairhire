import { clerkMiddleware, getAuth } from '@clerk/express';
import { Request, Response, NextFunction } from 'express';
import { systemPrisma } from '../lib/prisma';

// Processes the Clerk JWT on every request. Apply globally in index.ts.
export const clerkAuth = clerkMiddleware();

// Resolves clerkUserId → Manager row → attaches to req.manager.
// Uses systemPrisma (superuser) because this runs before app.current_manager_id
// is set, so the regular app_user client would return 0 rows due to RLS.
export async function attachManager(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const manager = await systemPrisma.manager.findUnique({
    where: { clerkUserId: userId },
  });

  if (!manager) {
    res.status(401).json({ error: 'Manager account not found — call POST /auth/sync first' });
    return;
  }

  req.manager = manager;
  next();
}

export const requireAuth = [clerkAuth, attachManager] as const;
