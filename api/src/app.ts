import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { clerkAuth, attachManager } from './middleware/requireAuth';
import { authRouter } from './routes/auth';
import { meetingsRouter } from './routes/meetings';
import { candidatesRouter } from './routes/candidates';
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
  // Sized above the transcript's Zod cap (500_000 chars) — and crucially above
  // its worst-case UTF-8 byte cost (4 bytes/char × 500k = 2MB) — so an over-long
  // transcript is rejected cleanly by validation (400) rather than by the body
  // parser (which would 413, or 500 if other middleware fields surface first).
  app.use(express.json({ limit: '4mb' }));

  app.use(clerkAuth);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use('/internal', internalRouter);

  app.use(attachManager);

  app.use('/meetings', meetingsRouter);
  app.use('/candidates', candidatesRouter);
  app.use('/decisions', decisionsRouter);
  app.use('/flags', flagsRouter);
  app.use('/hr', hrRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack ?? err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
