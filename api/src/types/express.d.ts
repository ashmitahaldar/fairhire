import type { Manager } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      // Populated by requireAuth middleware after Clerk JWT verification
      manager: Manager;
    }
  }
}
