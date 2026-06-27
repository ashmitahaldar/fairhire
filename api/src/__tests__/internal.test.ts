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
  // The /internal route looks up the run via systemPrisma (no manager context).
  systemPrisma: {
    manager: { findUnique: jest.fn() },
    analysisRun: { findUnique: jest.fn() },
  },
  withManagerContext: jest.fn(),
}));

import { createApp } from '../app';
import { systemPrisma, withManagerContext } from '../lib/prisma';

const app = createApp();
const mockFindUnique = jest.mocked(systemPrisma.analysisRun.findUnique);
const mockWithCtx = jest.mocked(withManagerContext);

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

describe('POST /internal/analysis/:runId/results — atomic claim (race)', () => {
  const SECRET = 'test-internal-secret';
  const TRANSCRIPT = 'Intro line. Not sure about the cultural fit. Closing line.';
  const validFlag = {
    flagType: 'hedging_language',
    excerpt: 'Not sure about the cultural fit.',
    reasoning: 'Vague.',
    confidenceScore: 0.8,
  };

  beforeAll(() => {
    process.env.INTERNAL_API_SECRET = SECRET;
  });

  beforeEach(() => {
    mockFindUnique.mockReset();
    mockWithCtx.mockReset();
    // Run looks non-terminal at lookup time so the fast path is passed and the
    // transactional conditional claim becomes the deciding guard. transcript is
    // needed because the route now computes FlagSpan offsets from it.
    mockFindUnique.mockResolvedValue({
      status: 'running',
      meetingId: 'meeting-1',
      meeting: { managerId: 'mgr-1', orgId: 'org-1', transcript: TRANSCRIPT },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it('writes the flag AND its FlagSpan rows when the conditional claim wins', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'flag-1' });
    const tx = {
      analysisRun: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      flag: { create },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithCtx.mockImplementation(async (_id: string, cb: any) => cb(tx));

    const res = await request(app)
      .post('/internal/analysis/run-1/results')
      .set('x-internal-secret', SECRET)
      .send({ flags: [validFlag] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, flagsWritten: 1 });
    // Regression: the route used to write via createMany, which can't nest
    // relations, so flags landed with ZERO FlagSpan rows and were invisible
    // in the Week 5 TipTap marginalia gutter. The verbatim excerpt must now
    // produce a span at its transcript offset.
    expect(create).toHaveBeenCalledTimes(1);
    const start = TRANSCRIPT.indexOf(validFlag.excerpt);
    expect(create.mock.calls[0][0].data.spans).toEqual({
      create: [{ startOffset: start, endOffset: start + validFlag.excerpt.length }],
    });
  });

  it('persists a flag with zero spans when the excerpt is not verbatim', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'flag-1' });
    const tx = {
      analysisRun: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      flag: { create },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithCtx.mockImplementation(async (_id: string, cb: any) => cb(tx));

    const res = await request(app)
      .post('/internal/analysis/run-1/results')
      .set('x-internal-secret', SECRET)
      .send({ flags: [{ ...validFlag, excerpt: 'a paraphrase that is not in the transcript' }] });

    expect(res.status).toBe(200);
    // No verbatim match → no spans. The gutter falls back to a card-only
    // display for these (see Gutter marginalia), but the flag is still saved.
    expect(create.mock.calls[0][0].data.spans).toEqual({ create: [] });
  });

  it('returns 409 and writes NO flags when a concurrent caller already claimed it (count = 0)', async () => {
    const create = jest.fn();
    const tx = {
      analysisRun: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      flag: { create },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithCtx.mockImplementation(async (_id: string, cb: any) => cb(tx));

    const res = await request(app)
      .post('/internal/analysis/run-1/results')
      .set('x-internal-secret', SECRET)
      .send({ flags: [validFlag] });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'AnalysisRun already finalised' });
    expect(create).not.toHaveBeenCalled();
  });
});
