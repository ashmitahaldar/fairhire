import express from 'express';
import cors from 'cors';
import { clerkAuth, attachManager } from './middleware/requireAuth';
import { authRouter } from './routes/auth';
import { meetingsRouter } from './routes/meetings';
import { decisionsRouter } from './routes/decisions';
import { flagsRouter } from './routes/flags';
import { hrRouter } from './routes/hr';
import { internalRouter } from './routes/internal';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.WEB_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Parse Clerk JWT on every request so getAuth(req) is available everywhere
app.use(clerkAuth);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Auth routes: /sync uses clerkAuth only; /me uses clerkAuth + attachManager (handled internally)
app.use('/auth', authRouter);

// Internal routes: authenticated by shared secret, not Clerk
app.use('/internal', internalRouter);

// All routes below require a valid Manager row
app.use(attachManager);

app.use('/meetings', meetingsRouter);
app.use('/decisions', decisionsRouter);
app.use('/flags', flagsRouter);
app.use('/hr', hrRouter);

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
