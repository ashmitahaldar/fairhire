import request from 'supertest';

jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: jest.fn(),
}));

jest.mock('../lib/prisma', () => ({
  prisma: {
    meeting: { findMany: jest.fn(), findUnique: jest.fn() },
    $queryRaw: jest.fn(),
  },
  systemPrisma: { manager: { findUnique: jest.fn() } },
  withManagerContext: jest.fn(),
}));

import { createApp } from '../app';

const app = createApp();

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
