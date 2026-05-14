import { clerkMiddleware, getAuth } from '@clerk/express';
import { Request, Response, NextFunction } from 'express';

export const requireAuth = [
  clerkMiddleware(),
  (req: Request, res: Response, next: NextFunction) => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    // Manager lookup and SET LOCAL app.current_manager_id wired in Step 4
    next();
  },
];
