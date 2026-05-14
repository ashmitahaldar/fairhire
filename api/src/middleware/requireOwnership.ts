import { Request, Response, NextFunction } from 'express';

// Validates that a resource belongs to the authenticated manager.
// Populated in Step 4 once the Manager lookup is wired up.
export function requireOwnership(_resourceType: string) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    // TODO: implement ownership check against req.manager
    next();
  };
}
