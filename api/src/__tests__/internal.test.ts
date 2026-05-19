import request from 'supertest';

jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: jest.fn(),
}));

jest.mock('../lib/prisma', () => ({
  prisma: {
    meeting: { findMany: jest.fn(), findUnique: jest.fn() },
    analysisRun: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
  },
  systemPrisma: { manager: { findUnique: jest.fn() } },
  withManagerContext: jest.fn(),
}));

import { createApp } from '../app';
import { prisma } from '../lib/prisma';

const app = createApp();
const mockFindUnique = jest.mocked(prisma.analysisRun.findUnique);

// /internal routes are authenticated by INTERNAL_API_SECRET, not Clerk.
// These tests verify the header guard without needing a real database or token.
describe('POST /internal/analysis/:runId/results', () => {
  it('returns 401 when the X-Internal-Secret header is absent', async () => {
    const res = await request(app)
      .post('/internal/analysis/some-run-id/results')
      .send({});

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when the X-Internal-Secret header has a wrong value', async () => {
    const res = await request(app)
      .post('/internal/analysis/some-run-id/results')
      .set('x-internal-secret', 'wrong-secret')
      .send({});

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });
});

describe('POST /internal/analysis/:runId/results — idempotency guard', () => {
  const SECRET = 'test-internal-secret';

  beforeAll(() => {
    process.env.INTERNAL_API_SECRET = SECRET;
  });

  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it('returns 409 when the run is already completed (prevents duplicate flags)', async () => {
    mockFindUnique.mockResolvedValue({
      status: 'completed',
      meetingId: 'meeting-1',
      meeting: { managerId: 'mgr-1', orgId: 'org-1' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await request(app)
      .post('/internal/analysis/run-1/results')
      .set('x-internal-secret', SECRET)
      .send({ flags: [] });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'AnalysisRun already completed' });
  });

  it('returns 404 when the run does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/internal/analysis/missing/results')
      .set('x-internal-secret', SECRET)
      .send({ flags: [] });

    expect(res.status).toBe(404);
  });

  it('returns 400 when the body fails validation', async () => {
    const res = await request(app)
      .post('/internal/analysis/run-1/results')
      .set('x-internal-secret', SECRET)
      .send({ flags: [{ flagType: 'not_a_real_type', excerpt: 'x' }] });

    expect(res.status).toBe(400);
  });
});
