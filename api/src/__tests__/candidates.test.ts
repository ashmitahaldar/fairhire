import request from 'supertest';
import { managerA, managerB } from './helpers';

const mockGetAuth = jest.fn();

jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: unknown) => mockGetAuth(req),
}));

jest.mock('../lib/prisma', () => ({
  prisma: {
    candidate: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    // GET /candidates also reads candidate_flag_counts() via $queryRaw.
    $queryRaw: jest.fn(),
  },
  systemPrisma: {
    manager: { findUnique: jest.fn() },
    // requireOwnership('candidate') uses systemPrisma so the auth check
    // itself isn't subject to RLS — it is the authorisation gate.
    meetingCandidate: { findFirst: jest.fn() },
  },
  withManagerContext: jest.fn(),
}));

import { createApp } from '../app';
import { prisma, systemPrisma, withManagerContext } from '../lib/prisma';

const mockSystemManagerFindUnique = systemPrisma.manager.findUnique as jest.Mock;
const mockSystemMeetingCandidateFindFirst = systemPrisma.meetingCandidate
  .findFirst as jest.Mock;
const mockCandidateFindMany = prisma.candidate.findMany as jest.Mock;
const mockCandidateCreate = prisma.candidate.create as jest.Mock;
const mockCandidateUpdate = prisma.candidate.update as jest.Mock;
const mockQueryRaw = prisma.$queryRaw as jest.Mock;
const mockWithManagerContext = withManagerContext as jest.Mock;

const app = createApp();

// A representative Prisma-shaped row the routes' select clauses produce.
// Centralised here so individual tests only override what matters.
function rowFromDb(overrides: Partial<{
  id: string;
  name: string;
  roleAppliedFor: string;
  createdAt: Date;
  demographics: unknown;
  meetingCount: number;
  lastOutcome: 'hired' | 'rejected' | 'in_progress' | 'promoted' | 'held' | null;
  lastMeetingType: 'hiring' | 'promotion';
  ownedByCaller: boolean;
}> = {}) {
  const {
    id = 'c1',
    name = 'Ahmad Faris',
    roleAppliedFor = 'Analyst',
    createdAt = new Date('2026-01-15T00:00:00Z'),
    demographics = null,
    meetingCount = 0,
    lastOutcome = null,
    lastMeetingType = 'hiring',
    ownedByCaller = false,
  } = overrides;
  return {
    id,
    name,
    roleAppliedFor,
    createdAt,
    demographics,
    _count: { meetings: meetingCount },
    // Mirrors the route's decisions select: outcome + the parent meeting's
    // mode (so promotion outcomes can be labelled correctly client-side).
    decisions: lastOutcome
      ? [{ outcome: lastOutcome, meeting: { meetingType: lastMeetingType } }]
      : [],
    meetings: ownedByCaller ? [{ meetingId: 'm1' }] : [],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWithManagerContext.mockImplementation(async (_id: string, fn: (tx: unknown) => unknown) =>
    fn(prisma)
  );
  // Default: no flag counts. Individual GET tests override to assert merging.
  mockQueryRaw.mockResolvedValue([]);
});

describe('GET /candidates', () => {
  it('returns enriched org candidates and filters out soft-deleted ones', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockCandidateFindMany.mockResolvedValue([
      rowFromDb({
        id: 'c1',
        name: 'Ahmad Faris',
        roleAppliedFor: 'Analyst',
        meetingCount: 2,
        lastOutcome: 'hired',
        ownedByCaller: true,
        demographics: { race: 'malay', gender: 'male' },
      }),
      rowFromDb({
        id: 'c2',
        name: 'Siti Nurhaliza',
        roleAppliedFor: 'Associate',
        meetingCount: 0,
        ownedByCaller: false,
      }),
    ]);
    // candidate_flag_counts(): c1 has 5 flags org-wide, 2 of them the
    // caller's own; c2 has none (absent → defaults to zero).
    mockQueryRaw.mockResolvedValueOnce([
      { candidate_id: 'c1', total: BigInt(5), own: BigInt(2) },
    ]);

    const res = await request(app).get('/candidates');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      id: 'c1',
      name: 'Ahmad Faris',
      roleAppliedFor: 'Analyst',
      demographics: { race: 'malay', gender: 'male' },
      meetingCount: 2,
      lastDecisionOutcome: 'hired',
      canModify: true,
      flagCount: { total: 5, own: 2 },
    });
    expect(res.body[0]).toMatchObject({ lastDecisionMeetingType: 'hiring' });
    expect(res.body[1]).toMatchObject({
      id: 'c2',
      canModify: false,
      lastDecisionOutcome: null,
      lastDecisionMeetingType: null,
      meetingCount: 0,
      flagCount: { total: 0, own: 0 },
    });
  });

  it('surfaces the meeting mode for a promotion decision so it labels correctly', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockCandidateFindMany.mockResolvedValue([
      rowFromDb({
        id: 'c1',
        lastOutcome: 'promoted',
        lastMeetingType: 'promotion',
        ownedByCaller: true,
      }),
    ]);

    const res = await request(app).get('/candidates');

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      lastDecisionOutcome: 'promoted',
      lastDecisionMeetingType: 'promotion',
    });

    // The list is scoped to the manager's org via the RLS session variable
    // (withManagerContext) AND filters out tombstoned rows in app code.
    expect(mockWithManagerContext).toHaveBeenCalledWith(managerA.id, expect.any(Function));
    expect(mockCandidateFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    );
  });

  it('canModify is per-row based on the caller\'s MeetingCandidate links', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockCandidateFindMany.mockResolvedValue([
      rowFromDb({ id: 'mine', ownedByCaller: true }),
      rowFromDb({ id: 'theirs', ownedByCaller: false }),
    ]);

    const res = await request(app).get('/candidates');

    expect(res.body.find((c: { id: string }) => c.id === 'mine').canModify).toBe(true);
    expect(res.body.find((c: { id: string }) => c.id === 'theirs').canModify).toBe(false);
    // The query scopes the meetings include to the caller's managerId, so
    // canModify can be derived without a second round-trip.
    expect(mockCandidateFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          meetings: expect.objectContaining({
            where: { meeting: { managerId: managerA.id } },
          }),
        }),
      }),
    );
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockReturnValue({ userId: null });

    const res = await request(app).get('/candidates');

    expect(res.status).toBe(401);
    expect(mockCandidateFindMany).not.toHaveBeenCalled();
  });
});

describe('POST /candidates', () => {
  it('creates a candidate scoped to the manager\'s org and returns the enriched shape', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockCandidateCreate.mockResolvedValue(
      rowFromDb({ id: 'new-c', name: 'Hannah Lim', roleAppliedFor: 'Associate Analyst' }),
    );

    const res = await request(app)
      .post('/candidates')
      .send({ name: 'Hannah Lim', roleAppliedFor: 'Associate Analyst' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 'new-c',
      name: 'Hannah Lim',
      roleAppliedFor: 'Associate Analyst',
      canModify: false,
    });
    // orgId comes from the authenticated manager, not the request body — so a
    // forged orgId can't smuggle a candidate into another org.
    expect(mockCandidateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Hannah Lim',
          roleAppliedFor: 'Associate Analyst',
          orgId: managerA.orgId,
        }),
      }),
    );
    expect(mockWithManagerContext).toHaveBeenCalledWith(managerA.id, expect.any(Function));
  });

  it('creates a candidate with nested demographics when provided', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockCandidateCreate.mockResolvedValue(rowFromDb({ id: 'new-c' }));

    await request(app)
      .post('/candidates')
      .send({
        name: 'Hannah Lim',
        roleAppliedFor: 'Associate Analyst',
        demographics: {
          race: 'chinese',
          gender: 'female',
          yearsInSingapore: 12,
        },
      });

    expect(mockCandidateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          demographics: {
            create: { race: 'chinese', gender: 'female', yearsInSingapore: 12 },
          },
        }),
      }),
    );
  });

  it('omits the nested demographics write entirely when the payload is an empty object', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockCandidateCreate.mockResolvedValue(rowFromDb({ id: 'new-c' }));

    await request(app)
      .post('/candidates')
      .send({
        name: 'Hannah Lim',
        roleAppliedFor: 'Associate Analyst',
        demographics: {}, // all keys undefined → should skip nested create
      });

    const call = mockCandidateCreate.mock.calls[0][0];
    // No demographics nested clause should appear — otherwise an empty
    // CandidateDemographics row gets created on every form save where the
    // user left every field blank.
    expect(call.data.demographics).toBeUndefined();
  });

  it('drops undefined demographic keys but preserves explicit nulls', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockCandidateCreate.mockResolvedValue(rowFromDb({ id: 'new-c' }));

    await request(app)
      .post('/candidates')
      .send({
        name: 'Hannah Lim',
        roleAppliedFor: 'Associate Analyst',
        demographics: { race: 'chinese', gender: null },
      });

    const call = mockCandidateCreate.mock.calls[0][0];
    expect(call.data.demographics.create).toEqual({ race: 'chinese', gender: null });
  });

  it('trims surrounding whitespace from name and role', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockCandidateCreate.mockResolvedValue(rowFromDb({ id: 'new-c' }));

    await request(app)
      .post('/candidates')
      .send({ name: '  Hannah Lim  ', roleAppliedFor: '  Associate Analyst  ' });

    expect(mockCandidateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Hannah Lim',
          roleAppliedFor: 'Associate Analyst',
          orgId: managerA.orgId,
        }),
      }),
    );
  });

  it('returns 400 when name is empty', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);

    const res = await request(app)
      .post('/candidates')
      .send({ name: '   ', roleAppliedFor: 'Associate Analyst' });

    expect(res.status).toBe(400);
    expect(mockCandidateCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when role is missing', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);

    const res = await request(app).post('/candidates').send({ name: 'Hannah Lim' });

    expect(res.status).toBe(400);
    expect(mockCandidateCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when a demographic enum value is invalid', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);

    const res = await request(app)
      .post('/candidates')
      .send({
        name: 'Hannah Lim',
        roleAppliedFor: 'Associate Analyst',
        demographics: { race: 'not-a-real-race' },
      });

    expect(res.status).toBe(400);
    expect(mockCandidateCreate).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockReturnValue({ userId: null });

    const res = await request(app)
      .post('/candidates')
      .send({ name: 'Hannah Lim', roleAppliedFor: 'Associate Analyst' });

    expect(res.status).toBe(401);
    expect(mockCandidateCreate).not.toHaveBeenCalled();
  });
});

describe('PATCH /candidates/:id', () => {
  const candidateId = 'cccccccc-1111-2222-3333-444444444444';

  it('updates core fields when the caller has interviewed the candidate', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    // ownership check passes — there's a MeetingCandidate link
    mockSystemMeetingCandidateFindFirst.mockResolvedValue({ meetingId: 'm-1' });
    mockCandidateUpdate.mockResolvedValue(
      rowFromDb({
        id: candidateId,
        name: 'Hannah L.',
        roleAppliedFor: 'Senior Analyst',
        ownedByCaller: true,
      }),
    );

    const res = await request(app)
      .patch(`/candidates/${candidateId}`)
      .send({ name: 'Hannah L.', roleAppliedFor: 'Senior Analyst' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: candidateId,
      name: 'Hannah L.',
      roleAppliedFor: 'Senior Analyst',
      canModify: true,
    });
    expect(mockCandidateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: candidateId },
        data: { name: 'Hannah L.', roleAppliedFor: 'Senior Analyst' },
      }),
    );
  });

  it('upserts demographics on PATCH (lazy create on first touch)', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockSystemMeetingCandidateFindFirst.mockResolvedValue({ meetingId: 'm-1' });
    mockCandidateUpdate.mockResolvedValue(rowFromDb({ id: candidateId, ownedByCaller: true }));

    await request(app)
      .patch(`/candidates/${candidateId}`)
      .send({ demographics: { race: 'indian', ageBand: 'age_30_39' } });

    expect(mockCandidateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          demographics: {
            upsert: {
              create: { race: 'indian', ageBand: 'age_30_39' },
              update: { race: 'indian', ageBand: 'age_30_39' },
            },
          },
        },
      }),
    );
  });

  it('returns 403 when the caller has no MeetingCandidate link', async () => {
    mockGetAuth.mockReturnValue({ userId: managerB.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerB);
    // ownership check fails — no link for managerB to this candidate
    mockSystemMeetingCandidateFindFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch(`/candidates/${candidateId}`)
      .send({ name: 'Whoever' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
    expect(mockCandidateUpdate).not.toHaveBeenCalled();
  });

  it('queries MeetingCandidate with deletedAt: null so writes on tombstoned candidates fail too', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockSystemMeetingCandidateFindFirst.mockResolvedValue(null);

    await request(app).patch(`/candidates/${candidateId}`).send({ name: 'X' });

    expect(mockSystemMeetingCandidateFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          candidateId,
          // orgId on the candidate relation is belt-and-braces — even if a
          // caller passes a candidate id from another org, the filter refuses.
          candidate: { deletedAt: null, orgId: managerA.orgId },
          meeting: { managerId: managerA.id },
        }),
      }),
    );
  });

  it('returns 400 on invalid body shape', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockSystemMeetingCandidateFindFirst.mockResolvedValue({ meetingId: 'm-1' });

    const res = await request(app)
      .patch(`/candidates/${candidateId}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(mockCandidateUpdate).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockReturnValue({ userId: null });

    const res = await request(app)
      .patch(`/candidates/${candidateId}`)
      .send({ name: 'Whoever' });

    expect(res.status).toBe(401);
    expect(mockSystemMeetingCandidateFindFirst).not.toHaveBeenCalled();
    expect(mockCandidateUpdate).not.toHaveBeenCalled();
  });
});

describe('DELETE /candidates/:id', () => {
  const candidateId = 'cccccccc-9999-9999-9999-999999999999';

  it('soft-deletes (sets deletedAt) and returns 204 when the caller owns the link', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockSystemMeetingCandidateFindFirst.mockResolvedValue({ meetingId: 'm-1' });
    mockCandidateUpdate.mockResolvedValue({ id: candidateId });

    const res = await request(app).delete(`/candidates/${candidateId}`);

    expect(res.status).toBe(204);
    expect(mockCandidateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: candidateId },
        data: { deletedAt: expect.any(Date) },
      }),
    );
  });

  it('returns 403 when the caller has not interviewed the candidate', async () => {
    mockGetAuth.mockReturnValue({ userId: managerB.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerB);
    mockSystemMeetingCandidateFindFirst.mockResolvedValue(null);

    const res = await request(app).delete(`/candidates/${candidateId}`);

    expect(res.status).toBe(403);
    expect(mockCandidateUpdate).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockReturnValue({ userId: null });

    const res = await request(app).delete(`/candidates/${candidateId}`);

    expect(res.status).toBe(401);
    expect(mockSystemMeetingCandidateFindFirst).not.toHaveBeenCalled();
    expect(mockCandidateUpdate).not.toHaveBeenCalled();
  });
});
