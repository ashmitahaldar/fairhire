import { Router } from 'express';

export const decisionsRouter = Router();

decisionsRouter.get('/', (_req, res) => {
  res.json({ message: 'decisions list stub' });
});

decisionsRouter.post('/', (_req, res) => {
  res.json({ message: 'create decision stub' });
});

decisionsRouter.patch('/:id', (_req, res) => {
  res.json({ message: 'update decision stub' });
});
