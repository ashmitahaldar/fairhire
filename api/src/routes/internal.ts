import { Router, Request, Response, NextFunction } from 'express';

export const internalRouter = Router();

// Guard: validates INTERNAL_API_SECRET header — not Clerk JWT
function requireInternalSecret(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers['x-internal-secret'];
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

internalRouter.use(requireInternalSecret);

// POST /internal/analysis/:runId/results — analysis engine writes flags here
internalRouter.post('/analysis/:runId/results', (_req, res) => {
  res.json({ message: 'analysis results stub' });
});
