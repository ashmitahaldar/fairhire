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
    $queryRaw: jest.fn(),
  },
  systemPrisma: {
    manager: { findUnique: jest.fn() },
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
const mockMeetingFindMany = prisma.meeting.findMany as jest.Mock;
const mockMeetingFindUnique = prisma.meeting.findUnique as jest.Mock;
const mockMeetingCreate = prisma.meeting.create as jest.Mock;
const mockAnalysisRunCreate = prisma.analysisRun.create as jest.Mock;
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
    // requireOwnership queries this meeting; it belongs to B, not A
    mockMeetingFindUnique.mockResolvedValue({ managerId: managerB.id });

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
});
