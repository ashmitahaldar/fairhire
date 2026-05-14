import { Router } from 'express';

export const flagsRouter = Router();

flagsRouter.get('/', (_req, res) => {
  res.json({ message: 'flags list stub' });
});

// PATCH /flags/:id — dismiss a flag with a reason
flagsRouter.patch('/:id', (_req, res) => {
  res.json({ message: 'dismiss flag stub' });
});
