import request from 'supertest';
import { managerA } from './helpers';

const mockGetAuth = jest.fn();

jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: unknown) => mockGetAuth(req),
}));

// systemPrisma.manager.findUnique is hit twice per request:
//   1. attachManager — clerkUserId → Manager row (req.manager)
//   2. the route — id → name + dept.name for the header
// Distinguished via the `where` shape in the implementation; the mock
// returns whatever the caller queued for that call number.
jest.mock('../lib/prisma', () => ({
  prisma: {
    meeting: { findMany: jest.fn() },
    flag: { groupBy: jest.fn() },
    candidate: { findMany: jest.fn() },
  },
  systemPrisma: {
    manager: { findUnique: jest.fn() },
  },
  withManagerContext: jest.fn(),
}));

import { createApp } from '../app';
import { prisma, systemPrisma, withManagerContext } from '../lib/prisma';

const mockSystemManagerFindUnique = systemPrisma.manager.findUnique as jest.Mock;
const mockMeetingFindMany = prisma.meeting.findMany as jest.Mock;
const mockFlagGroupBy = prisma.flag.groupBy as jest.Mock;
const mockCandidateFindMany = prisma.candidate.findMany as jest.Mock;
const mockWithManagerContext = withManagerContext as jest.Mock;

const app = createApp();

const managerHeader = {
  name: managerA.name,
  dept: { name: 'Group Strategy & Sustainability' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWithManagerContext.mockImplementation(async (_id: string, fn: (tx: unknown) => unknown) =>
    fn(prisma)
  );
  // Shape-dispatch the two systemPrisma.manager.findUnique sites:
  //   - attachManager queries by clerkUserId
  //   - the route queries by id (with dept include)
  // Order-independent: avoids brittleness when individual tests skip one
  // of the two call sites (e.g. 401 path doesn't hit either, 400 path
  // hits only attachManager).
  mockSystemManagerFindUnique.mockImplementation(async (args: {
    where: { clerkUserId?: string; id?: string };
  }) => {
    if (args.where.clerkUserId) return managerA;
    if (args.where.id) return managerHeader;
    return null;
  });
  mockMeetingFindMany.mockResolvedValue([]);
  mockFlagGroupBy.mockResolvedValue([]);
  mockCandidateFindMany.mockResolvedValue([]);
});

describe('GET /mirror', () => {
  it('returns the MirrorData shape with empty Phase A data for an empty manager', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });

    const res = await request(app).get('/mirror');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      manager: { name: managerA.name, team: 'Group Strategy & Sustainability' },
      periodKey: '90d',
      period: 'Last 90 days',
      summary: { interviewsCount: 0, totalFlags: 0 },
      decisions: [],
      recentDecisions: [],
      languageFlags: [],
      nudges: [],
    });
    // Pipeline always returns the 4 stages; with no candidates each row is
    // present but zeroed.
    expect(res.body.pipeline.map((r: { stage: string }) => r.stage)).toEqual([
      'Applied',
      'Interviewed',
      'Hired',
      'Rejected',
    ]);
    expect(res.body.pipeline.every((r: { total: number }) => r.total === 0)).toBe(true);
    expect(mockWithManagerContext).toHaveBeenCalledWith(managerA.id, expect.any(Function));
  });

  it('defaults to 90d when no period is supplied', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    const res = await request(app).get('/mirror');
    expect(res.body.periodKey).toBe('90d');
  });

  it('accepts an explicit period query and reflects it in the response', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    const res = await request(app).get('/mirror?period=30d');
    expect(res.status).toBe(200);
    expect(res.body.periodKey).toBe('30d');
    expect(res.body.period).toBe('Last 30 days');
  });

  it('returns 400 when period is not one of the allowed values', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    const res = await request(app).get('/mirror?period=2y');
    expect(res.status).toBe(400);
    expect(mockMeetingFindMany).not.toHaveBeenCalled();
  });

  // ── Week 5 Step 6: meetingType filter ────────────────────────────────
  it('defaults to meetingType=hiring and scopes the meeting query accordingly', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    const res = await request(app).get('/mirror');
    expect(res.status).toBe(200);
    // The aggregator's first call is the meeting findMany. The where
    // clause should narrow to hiring meetings by default.
    expect(mockMeetingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ meetingType: 'hiring' }),
      }),
    );
  });

  it('passes meetingType=promotion through to the query and skips pipelineCandidates', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    const res = await request(app).get('/mirror?meetingType=promotion');
    expect(res.status).toBe(200);
    expect(mockMeetingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ meetingType: 'promotion' }),
      }),
    );
    expect(mockFlagGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          meeting: expect.objectContaining({ meetingType: 'promotion' }),
        }),
      }),
    );
    // Promotion mode skips the pipelineCandidates query (the funnel
    // concept doesn't apply); the aggregator inlines a [] for the
    // candidate list, so every pipeline stage row ends up with total 0.
    expect(mockCandidateFindMany).not.toHaveBeenCalled();
    expect(res.body.pipeline.every((row: { total: number }) => row.total === 0)).toBe(true);
  });

  it('returns 400 for an unknown meetingType value', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    const res = await request(app).get('/mirror?meetingType=offboarding');
    expect(res.status).toBe(400);
    expect(mockMeetingFindMany).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockReturnValue({ userId: null });
    const res = await request(app).get('/mirror');
    expect(res.status).toBe(401);
    expect(mockMeetingFindMany).not.toHaveBeenCalled();
  });

  it('aggregates real meetings into the summary numbers', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    const now = new Date();
    mockMeetingFindMany.mockResolvedValue([
      {
        id: 'm1',
        date: new Date(now.getTime() - 7 * 86400_000),
        candidates: [
          { candidateId: 'c1', candidate: { name: 'Ahmad Faris', roleAppliedFor: 'Analyst' } },
        ],
        flags: [
          { flagType: 'age_bias', dismissed: false },
          { flagType: 'age_bias', dismissed: true },
        ],
        decisions: [{ id: 'd1', outcome: 'hired', candidateId: 'c1' }],
      },
    ]);

    const res = await request(app).get('/mirror?period=30d');

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      interviewsCount: 1,
      rolesCount: 1,
      totalFlags: 2,
      dismissedFlags: 1,
      topCategory: 'Energy / pace language',
    });
    expect(res.body.decisions[0]).toMatchObject({
      candidate: 'Ahmad',
      surname: 'Faris',
      outcome: 'Hired',
    });
  });
});
