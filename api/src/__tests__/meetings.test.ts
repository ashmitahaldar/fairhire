import request from 'supertest';
import { managerA, managerB } from './helpers';

const mockGetAuth = jest.fn();

jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: unknown) => mockGetAuth(req),
}));

jest.mock('../lib/prisma', () => ({
  prisma: {
    meeting: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    analysisRun: { create: jest.fn() },
    // Promotion meetings nest-update the first candidate row with
    // currentRole / tenureYears / lastPromotedAt — mocked here so
    // route tests can assert on the call.
    candidate: { update: jest.fn() },
    // Re-run analysis wipes existing flags before scheduling the new run.
    flag: { deleteMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
  systemPrisma: {
    manager: { findUnique: jest.fn() },
    // requireOwnership uses systemPrisma so the auth check itself isn't
    // subject to RLS — it is the authorisation gate.
    meeting: { findUnique: jest.fn() },
  },
  withManagerContext: jest.fn(),
}));

// runAnalysis is fired via setImmediate after the response; mock it so the
// real LLM/DB pipeline never runs and we can assert it was scheduled.
jest.mock('../analysis/analyseTranscript', () => ({
  runAnalysis: jest.fn().mockResolvedValue(undefined),
}));

import { createApp } from '../app';
import { prisma, systemPrisma, withManagerContext } from '../lib/prisma';
import { runAnalysis } from '../analysis/analyseTranscript';

const mockSystemManagerFindUnique = systemPrisma.manager.findUnique as jest.Mock;
const mockSystemMeetingFindUnique = systemPrisma.meeting.findUnique as jest.Mock;
const mockMeetingFindMany = prisma.meeting.findMany as jest.Mock;
const mockMeetingCreate = prisma.meeting.create as jest.Mock;
const mockAnalysisRunCreate = prisma.analysisRun.create as jest.Mock;
const mockCandidateUpdate = prisma.candidate.update as jest.Mock;
const mockFlagDeleteMany = prisma.flag.deleteMany as jest.Mock;
const mockWithManagerContext = withManagerContext as jest.Mock;
const mockRunAnalysis = jest.mocked(runAnalysis);

const flushSetImmediate = () => new Promise((resolve) => setImmediate(resolve));

const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();
  mockWithManagerContext.mockImplementation(async (_id: string, fn: (tx: unknown) => unknown) =>
    fn(prisma)
  );
});

describe('GET /meetings', () => {
  it('returns only the authenticated manager\'s meetings', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);

    const meetingsForA = [
      { id: 'meeting-1', managerId: managerA.id, title: 'Interview 1', date: new Date() },
    ];
    mockMeetingFindMany.mockResolvedValue(meetingsForA);

    const res = await request(app).get('/meetings');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].managerId).toBe(managerA.id);
    // Confirms the route passes the correct manager ID to withManagerContext,
    // which is what sets app.current_manager_id for RLS on the real database.
    expect(mockWithManagerContext).toHaveBeenCalledWith(managerA.id, expect.any(Function));
  });
});

describe('GET /meetings/:id', () => {
  it('returns 403 when fetching a meeting owned by a different manager', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    // requireOwnership uses systemPrisma; this meeting belongs to B, not A
    mockSystemMeetingFindUnique.mockResolvedValue({ managerId: managerB.id });

    const res = await request(app).get(`/meetings/${managerB.id}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });
});

describe('POST /meetings', () => {
  const candidateId = '11111111-1111-1111-1111-111111111111';
  const validBody = {
    title: 'Panel interview',
    transcript: 'Strong technical answers across the board.',
    date: new Date().toISOString(),
    candidateIds: [candidateId],
  };

  it('creates a meeting + pending analysisRun and schedules runAnalysis', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockMeetingCreate.mockResolvedValue({
      id: 'meeting-1',
      managerId: managerA.id,
      title: validBody.title,
      candidates: [],
    });
    mockAnalysisRunCreate.mockResolvedValue({ id: 'run-1' });

    const res = await request(app).post('/meetings').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('meeting-1');

    // The analysis run is created as pending, scoped to the manager's org.
    expect(mockAnalysisRunCreate).toHaveBeenCalledWith({
      data: { meetingId: 'meeting-1', orgId: managerA.orgId, status: 'pending' },
    });

    // Background analysis is scheduled (after the response) with only the runId.
    await flushSetImmediate();
    expect(mockRunAnalysis).toHaveBeenCalledWith('run-1');
  });

  it('returns 400 for an invalid body and does not schedule analysis', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);

    const res = await request(app).post('/meetings').send({ title: '' });

    expect(res.status).toBe(400);
    await flushSetImmediate();
    expect(mockRunAnalysis).not.toHaveBeenCalled();
    expect(mockAnalysisRunCreate).not.toHaveBeenCalled();
  });

  it('forwards an optional transcriptFilename to meeting.create', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockMeetingCreate.mockResolvedValue({
      id: 'meeting-2',
      managerId: managerA.id,
      title: validBody.title,
      candidates: [],
    });
    mockAnalysisRunCreate.mockResolvedValue({ id: 'run-2' });

    const res = await request(app)
      .post('/meetings')
      .send({ ...validBody, transcriptFilename: 'panel-debrief.txt' });

    expect(res.status).toBe(201);
    expect(mockMeetingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ transcriptFilename: 'panel-debrief.txt' }),
      })
    );
    await flushSetImmediate();
  });

  it('returns 400 when the transcript exceeds the max length', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);

    const res = await request(app)
      .post('/meetings')
      .send({ ...validBody, transcript: 'x'.repeat(500_001) });

    expect(res.status).toBe(400);
    await flushSetImmediate();
    expect(mockMeetingCreate).not.toHaveBeenCalled();
    expect(mockRunAnalysis).not.toHaveBeenCalled();
  });

  // ── Week 5: Hiring/Promotion split ──────────────────────────────────
  it('defaults meetingType to "hiring" when omitted from the body (back-compat)', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockMeetingCreate.mockResolvedValue({
      id: 'meeting-hiring',
      managerId: managerA.id,
      title: validBody.title,
      candidates: [],
    });
    mockAnalysisRunCreate.mockResolvedValue({ id: 'run-hiring' });

    const res = await request(app).post('/meetings').send(validBody);

    expect(res.status).toBe(201);
    expect(mockMeetingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ meetingType: 'hiring' }),
      }),
    );
    expect(mockCandidateUpdate).not.toHaveBeenCalled();
    await flushSetImmediate();
  });

  it('persists meetingType + promotion fields when meetingType is "promotion"', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockMeetingCreate.mockResolvedValue({
      id: 'meeting-promo',
      managerId: managerA.id,
      title: validBody.title,
      candidates: [],
    });
    mockCandidateUpdate.mockResolvedValue({});
    mockAnalysisRunCreate.mockResolvedValue({ id: 'run-promo' });

    const res = await request(app)
      .post('/meetings')
      .send({
        ...validBody,
        meetingType: 'promotion',
        currentRole: 'Senior Associate',
        tenureYears: 5,
        lastPromotedAt: '2024-04-01T00:00:00.000Z',
      });

    expect(res.status).toBe(201);
    // Meeting persisted with promotion mode.
    expect(mockMeetingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ meetingType: 'promotion' }),
      }),
    );
    // First candidate gets the promotion-only fields written.
    expect(mockCandidateUpdate).toHaveBeenCalledWith({
      where: { id: candidateId },
      data: {
        currentRole: 'Senior Associate',
        tenureYears: 5,
        lastPromotedAt: new Date('2024-04-01T00:00:00.000Z'),
      },
    });
    await flushSetImmediate();
  });

  it('rejects a promotion body missing the promotion-only fields', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);

    const res = await request(app)
      .post('/meetings')
      .send({ ...validBody, meetingType: 'promotion' }); // missing currentRole, tenureYears

    expect(res.status).toBe(400);
    expect(mockMeetingCreate).not.toHaveBeenCalled();
    await flushSetImmediate();
  });
});

// ── Week 5 Step 5: re-run analysis endpoint ───────────────────────────────
describe('POST /meetings/:id/analyse — re-run', () => {
  const meetingId = '22222222-2222-2222-2222-222222222222';

  it('wipes existing flags, creates a new pending run, schedules runAnalysis', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    // requireOwnership('meeting') uses systemPrisma — this meeting belongs to A
    mockSystemMeetingFindUnique.mockResolvedValue({ managerId: managerA.id });
    mockFlagDeleteMany.mockResolvedValue({ count: 3 });
    mockAnalysisRunCreate.mockResolvedValue({ id: 'rerun-1' });

    const res = await request(app).post(`/meetings/${meetingId}/analyse`);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ runId: 'rerun-1' });
    expect(mockFlagDeleteMany).toHaveBeenCalledWith({ where: { meetingId } });
    expect(mockAnalysisRunCreate).toHaveBeenCalledWith({
      data: { meetingId, orgId: managerA.orgId, status: 'pending' },
    });

    await flushSetImmediate();
    expect(mockRunAnalysis).toHaveBeenCalledWith('rerun-1');
  });

  it('returns 403 for a meeting owned by another manager', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockSystemMeetingFindUnique.mockResolvedValue({ managerId: managerB.id });

    const res = await request(app).post(`/meetings/${meetingId}/analyse`);

    expect(res.status).toBe(403);
    expect(mockFlagDeleteMany).not.toHaveBeenCalled();
    expect(mockAnalysisRunCreate).not.toHaveBeenCalled();
    await flushSetImmediate();
    expect(mockRunAnalysis).not.toHaveBeenCalled();
  });
});
