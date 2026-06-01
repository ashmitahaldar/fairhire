import request from 'supertest';
import { managerA } from './helpers';

const mockGetAuth = jest.fn();

jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: unknown) => mockGetAuth(req),
}));

jest.mock('../lib/prisma', () => ({
  prisma: {
    candidate: { findMany: jest.fn(), create: jest.fn() },
  },
  systemPrisma: {
    manager: { findUnique: jest.fn() },
  },
  withManagerContext: jest.fn(),
}));

import { createApp } from '../app';
import { prisma, systemPrisma, withManagerContext } from '../lib/prisma';

const mockSystemManagerFindUnique = systemPrisma.manager.findUnique as jest.Mock;
const mockCandidateFindMany = prisma.candidate.findMany as jest.Mock;
const mockCandidateCreate = prisma.candidate.create as jest.Mock;
const mockWithManagerContext = withManagerContext as jest.Mock;

const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();
  mockWithManagerContext.mockImplementation(async (_id: string, fn: (tx: unknown) => unknown) =>
    fn(prisma)
  );
});

describe('GET /candidates', () => {
  it('returns the org candidates, scoped via withManagerContext', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockCandidateFindMany.mockResolvedValue([
      { id: 'c1', name: 'Ahmad Faris', roleAppliedFor: 'Analyst' },
      { id: 'c2', name: 'Siti Nurhaliza', roleAppliedFor: 'Associate' },
    ]);

    const res = await request(app).get('/candidates');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toEqual({ id: 'c1', name: 'Ahmad Faris', roleAppliedFor: 'Analyst' });
    // The list is scoped to the manager's org via the RLS session variable.
    expect(mockWithManagerContext).toHaveBeenCalledWith(managerA.id, expect.any(Function));
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockReturnValue({ userId: null });

    const res = await request(app).get('/candidates');

    expect(res.status).toBe(401);
    expect(mockCandidateFindMany).not.toHaveBeenCalled();
  });
});

describe('POST /candidates', () => {
  it('creates a candidate scoped to the manager\'s org and returns 201', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockCandidateCreate.mockResolvedValue({
      id: 'new-c',
      name: 'Hannah Lim',
      roleAppliedFor: 'Associate Analyst',
    });

    const res = await request(app)
      .post('/candidates')
      .send({ name: 'Hannah Lim', roleAppliedFor: 'Associate Analyst' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 'new-c',
      name: 'Hannah Lim',
      roleAppliedFor: 'Associate Analyst',
    });
    // orgId comes from the authenticated manager, not the request body — so a
    // forged orgId can't smuggle a candidate into another org.
    expect(mockCandidateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Hannah Lim', roleAppliedFor: 'Associate Analyst', orgId: managerA.orgId },
      }),
    );
    expect(mockWithManagerContext).toHaveBeenCalledWith(managerA.id, expect.any(Function));
  });

  it('trims surrounding whitespace from name and role', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockCandidateCreate.mockResolvedValue({
      id: 'new-c',
      name: 'Hannah Lim',
      roleAppliedFor: 'Associate Analyst',
    });

    await request(app)
      .post('/candidates')
      .send({ name: '  Hannah Lim  ', roleAppliedFor: '  Associate Analyst  ' });

    expect(mockCandidateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Hannah Lim', roleAppliedFor: 'Associate Analyst', orgId: managerA.orgId },
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

  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockReturnValue({ userId: null });

    const res = await request(app)
      .post('/candidates')
      .send({ name: 'Hannah Lim', roleAppliedFor: 'Associate Analyst' });

    expect(res.status).toBe(401);
    expect(mockCandidateCreate).not.toHaveBeenCalled();
  });
});
