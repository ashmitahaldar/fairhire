import express from 'express';
import cors from 'cors';
import { clerkAuth, attachManager } from './middleware/requireAuth';
import { authRouter } from './routes/auth';
import { meetingsRouter } from './routes/meetings';
import { decisionsRouter } from './routes/decisions';
import { flagsRouter } from './routes/flags';
import { hrRouter } from './routes/hr';
import { internalRouter } from './routes/internal';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: process.env.WEB_URL || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json());

  app.use(clerkAuth);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use('/internal', internalRouter);

  app.use(attachManager);

  app.use('/meetings', meetingsRouter);
  app.use('/decisions', decisionsRouter);
  app.use('/flags', flagsRouter);
  app.use('/hr', hrRouter);

  return app;
}
