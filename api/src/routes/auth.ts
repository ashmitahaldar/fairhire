import { Router } from 'express';

export const authRouter = Router();

// POST /auth/sync — creates a Manager row on first Clerk login
authRouter.post('/sync', (_req, res) => {
  res.json({ message: 'auth sync stub — wired in Step 4' });
});

// GET /auth/me — returns the current manager's profile (role, orgId, etc.)
authRouter.get('/me', (_req, res) => {
  res.json({ message: 'auth me stub — wired in Step 4' });
});
