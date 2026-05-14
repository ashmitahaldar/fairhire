import express from 'express';
import { authRouter } from './routes/auth';
import { meetingsRouter } from './routes/meetings';
import { decisionsRouter } from './routes/decisions';
import { flagsRouter } from './routes/flags';
import { hrRouter } from './routes/hr';
import { internalRouter } from './routes/internal';
import { requireAuth } from './middleware/requireAuth';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);

app.use(requireAuth);

app.use('/meetings', meetingsRouter);
app.use('/decisions', decisionsRouter);
app.use('/flags', flagsRouter);
app.use('/hr', hrRouter);
app.use('/internal', internalRouter);

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
