import { clerkMiddleware, getAuth } from '@clerk/express';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

// Step 1: verify Clerk JWT is present and valid
export const clerkAuth = clerkMiddleware();

// Step 2: resolve Clerk userId → Manager row → attach to req.manager
export async function attachManager(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const manager = await prisma.manager.findUnique({
    where: { clerkUserId: userId },
  });

  if (!manager) {
    res.status(401).json({ error: 'Manager account not found — complete sign-up first' });
    return;
  }

  req.manager = manager;
  next();
}

// Compose both steps — use this on all protected routes
export const requireAuth = [clerkAuth, attachManager];
