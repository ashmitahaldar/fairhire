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
import { mirrorRouter } from './routes/mirror';

// Allowed browser origins. Vercel assigns every deployment its own hostname
// (production alias + per-deployment + per-branch preview URLs), so a single
// exact origin can't cover them all. We allow:
//   - the canonical alias(es) from WEB_URL (comma-separated for >1),
//   - localhost for dev,
//   - this project's Vercel deployment/preview URLs by pattern
//     (e.g. fairhire-<hash>-ashmitahaldars-projects.vercel.app). Override the
//     pattern via WEB_ORIGIN_REGEX if the Vercel project/team slug changes.
// The cors package reflects the matched origin back (required with
// credentials: true, which forbids a wildcard ACAO).
function buildAllowedOrigins(): (string | RegExp)[] {
  const exact = (process.env.WEB_URL ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  exact.push('http://localhost:5173'); // always allow local dev

  const previewPattern = process.env.WEB_ORIGIN_REGEX
    ? new RegExp(process.env.WEB_ORIGIN_REGEX)
    : /^https:\/\/fairhire-[a-z0-9-]+-ashmitahaldars-projects\.vercel\.app$/;

  return [...new Set(exact), previewPattern];
}

export function createApp() {
  const app = express();

  app.use(cors({
    origin: buildAllowedOrigins(),
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
  app.use('/mirror', mirrorRouter);
  app.use('/hr', hrRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack ?? err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
