import request from 'supertest';
import { managerA, managerB } from './helpers';

const mockGetAuth = jest.fn();

jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: unknown) => mockGetAuth(req),
}));

jest.mock('../lib/prisma', () => ({
  prisma: {
    decision: { create: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn(),
  },
  systemPrisma: {
    manager: { findUnique: jest.fn() },
    // requireOwnership('decision') resolves the decision's owning manager.
    decision: { findUnique: jest.fn() },
  },
  withManagerContext: jest.fn(),
}));

import { createApp } from '../app';
import { prisma, systemPrisma, withManagerContext } from '../lib/prisma';

const mockSystemManagerFindUnique = systemPrisma.manager.findUnique as jest.Mock;
const mockSystemDecisionFindUnique = systemPrisma.decision.findUnique as jest.Mock;
const mockDecisionCreate = prisma.decision.create as jest.Mock;
const mockDecisionUpdate = prisma.decision.update as jest.Mock;
const mockWithManagerContext = withManagerContext as jest.Mock;

const app = createApp();
const MEETING_ID = '11111111-1111-1111-1111-111111111111';
const CANDIDATE_ID = '22222222-2222-2222-2222-222222222222';
const DECISION_ID = '33333333-3333-3333-3333-333333333333';

beforeEach(() => {
  jest.clearAllMocks();
  mockWithManagerContext.mockImplementation(async (_id: string, fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
  mockSystemManagerFindUnique.mockResolvedValue(managerA);
});

describe('POST /decisions — outcome validation', () => {
  // Regression: the route used to hard-code z.enum(['hired','rejected',
  // 'in_progress']), so promotion outcomes (promoted/held) — which the
  // Decision panel offers in promotion mode — were rejected with a 400.
  it.each(['promoted', 'held'] as const)('accepts the promotion outcome %s', async (outcome) => {
    mockDecisionCreate.mockResolvedValue({ id: DECISION_ID, outcome });

    const res = await request(app)
      .post('/decisions')
      .send({ meetingId: MEETING_ID, candidateId: CANDIDATE_ID, outcome });

    expect(res.status).toBe(201);
    expect(mockDecisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outcome }) }),
    );
  });

  it('still accepts the hiring outcomes (back-compat)', async () => {
    mockDecisionCreate.mockResolvedValue({ id: DECISION_ID, outcome: 'hired' });

    const res = await request(app)
      .post('/decisions')
      .send({ meetingId: MEETING_ID, candidateId: CANDIDATE_ID, outcome: 'hired' });

    expect(res.status).toBe(201);
  });

  it('rejects an unknown outcome value', async () => {
    const res = await request(app)
      .post('/decisions')
      .send({ meetingId: MEETING_ID, candidateId: CANDIDATE_ID, outcome: 'offboarded' });

    expect(res.status).toBe(400);
    expect(mockDecisionCreate).not.toHaveBeenCalled();
  });
});

describe('PATCH /decisions/:id — outcome validation', () => {
  it('accepts a promotion outcome on a decision the caller owns', async () => {
    mockSystemDecisionFindUnique.mockResolvedValue({ managerId: managerA.id });
    mockDecisionUpdate.mockResolvedValue({ id: DECISION_ID, outcome: 'held' });

    const res = await request(app).patch(`/decisions/${DECISION_ID}`).send({ outcome: 'held' });

    expect(res.status).toBe(200);
    expect(mockDecisionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outcome: 'held' }) }),
    );
  });

  it('returns 403 when the decision belongs to another manager', async () => {
    mockSystemDecisionFindUnique.mockResolvedValue({ managerId: managerB.id });

    const res = await request(app).patch(`/decisions/${DECISION_ID}`).send({ outcome: 'promoted' });

    expect(res.status).toBe(403);
    expect(mockDecisionUpdate).not.toHaveBeenCalled();
  });
});
