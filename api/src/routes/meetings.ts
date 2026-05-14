import { Router } from 'express';

export const meetingsRouter = Router();

meetingsRouter.get('/', (_req, res) => {
  res.json({ message: 'meetings list stub' });
});

meetingsRouter.post('/', (_req, res) => {
  res.json({ message: 'create meeting stub' });
});

meetingsRouter.get('/:id', (_req, res) => {
  res.json({ message: 'get meeting stub' });
});
