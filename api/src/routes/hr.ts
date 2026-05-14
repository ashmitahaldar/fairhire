import { Router } from 'express';
import { requireRole } from '../middleware/requireRole';

export const hrRouter = Router();

// All /hr/* routes require hr_admin role. Aggregate data only — never individual rows.
hrRouter.use(requireRole('hr_admin'));

hrRouter.get('/summary', (_req, res) => {
  res.json({ message: 'hr summary stub — aggregate counts only' });
});
