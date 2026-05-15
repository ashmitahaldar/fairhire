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
    },
    $queryRaw: jest.fn(),
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
const mockMeetingFindUnique = prisma.meeting.findUnique as jest.Mock;
const mockWithManagerContext = withManagerContext as jest.Mock;

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
