import request from 'supertest';
import { managerA, hrAdmin } from './helpers';

const mockGetAuth = jest.fn();

jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: unknown) => mockGetAuth(req),
}));

jest.mock('../lib/prisma', () => ({
  prisma: {},
  systemPrisma: {
    organisation: { findFirst: jest.fn() },
    department: { findFirst: jest.fn() },
    manager: { upsert: jest.fn(), findUnique: jest.fn() },
  },
  withManagerContext: jest.fn(),
}));

import { createApp } from '../app';
import { systemPrisma, withManagerContext } from '../lib/prisma';

const mockOrgFindFirst = systemPrisma.organisation.findFirst as jest.Mock;
const mockDeptFindFirst = systemPrisma.department.findFirst as jest.Mock;
const mockUpsert = systemPrisma.manager.upsert as jest.Mock;
const mockFindUnique = systemPrisma.manager.findUnique as jest.Mock;
const mockWithCtx = withManagerContext as jest.Mock;

const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();
  mockOrgFindFirst.mockResolvedValue({ id: 'org-id' });
  mockDeptFindFirst.mockResolvedValue({ id: 'dept-id' });
});

describe('POST /auth/sync', () => {
  it('creates the Manager row with the self-selected role on first sign-in', async () => {
    mockGetAuth.mockReturnValue({ userId: 'clerk-new-hr' });
    mockUpsert.mockResolvedValue(hrAdmin);

    const res = await request(app)
      .post('/auth/sync')
      .send({ name: 'New HR', email: 'hr@test.com', role: 'hr_admin' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('hr_admin');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ role: 'hr_admin' }),
        update: {},
      }),
    );
  });

  it('defaults to manager when no role is supplied', async () => {
    mockGetAuth.mockReturnValue({ userId: 'clerk-new-mgr' });
    mockUpsert.mockResolvedValue(managerA);

    const res = await request(app)
      .post('/auth/sync')
      .send({ name: 'New Mgr', email: 'm@test.com' });

    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ role: 'manager' }) }),
    );
  });

  it('rejects an unknown role with 400 and never writes', async () => {
    mockGetAuth.mockReturnValue({ userId: 'clerk-bad' });

    const res = await request(app)
      .post('/auth/sync')
      .send({ name: 'X', email: 'x@test.com', role: 'superuser' });

    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe('GET /auth/me', () => {
  it('returns the profile for a provisioned account', async () => {
    mockGetAuth.mockReturnValue({ userId: hrAdmin.clerkUserId });
    mockFindUnique.mockResolvedValue(hrAdmin);

    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: 'hr_admin', orgId: hrAdmin.orgId });
  });

  it('returns 404 (not 401) when the Clerk user has no Manager row yet', async () => {
    // This is the contract the frontend relies on to show the first-run role
    // picker rather than treating an unprovisioned account as an auth failure.
    mockGetAuth.mockReturnValue({ userId: 'clerk-unprovisioned' });
    mockFindUnique.mockResolvedValue(null);

    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(404);
  });
});

describe('GET /auth/departments', () => {
  it('returns the org-scoped division list', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockFindUnique.mockResolvedValue(managerA);
    const list = [
      { id: 'dept-ib', name: 'Investment Banking' },
      { id: 'dept-gm', name: 'Global Markets' },
    ];
    mockWithCtx.mockImplementation((_id: string, cb: (tx: unknown) => unknown) =>
      cb({ department: { findMany: jest.fn().mockResolvedValue(list) } }),
    );

    const res = await request(app).get('/auth/departments');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(list);
    // Scoped to the caller — read inside their RLS context, not systemPrisma.
    expect(mockWithCtx).toHaveBeenCalledWith(managerA.id, expect.any(Function));
  });
});

describe('PATCH /auth/me', () => {
  it('moves the manager to a different division in their org', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockFindUnique.mockResolvedValue(managerA);
    const updateMock = jest.fn().mockResolvedValue({ ...managerA, deptId: 'dept-gm' });
    mockWithCtx.mockImplementation((_id: string, cb: (tx: unknown) => unknown) =>
      cb({
        department: { findUnique: jest.fn().mockResolvedValue({ id: 'dept-gm' }) },
        manager: { update: updateMock },
      }),
    );

    const res = await request(app).patch('/auth/me').send({ deptId: 'dept-gm' });

    expect(res.status).toBe(200);
    expect(res.body.deptId).toBe('dept-gm');
    // Only deptId is written — never role, even if the policy would allow it.
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deptId: 'dept-gm' } }),
    );
  });

  it('ignores a role field smuggled into the body (role stays put)', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockFindUnique.mockResolvedValue(managerA);
    const updateMock = jest.fn().mockResolvedValue({ ...managerA, deptId: 'dept-gm' });
    mockWithCtx.mockImplementation((_id: string, cb: (tx: unknown) => unknown) =>
      cb({
        department: { findUnique: jest.fn().mockResolvedValue({ id: 'dept-gm' }) },
        manager: { update: updateMock },
      }),
    );

    const res = await request(app)
      .patch('/auth/me')
      .send({ deptId: 'dept-gm', role: 'hr_admin' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('manager');
    const writtenData = updateMock.mock.calls[0][0].data;
    expect(writtenData).toEqual({ deptId: 'dept-gm' });
    expect(writtenData).not.toHaveProperty('role');
  });

  it('rejects a division outside the org with 400 and never writes', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockFindUnique.mockResolvedValue(managerA);
    const updateMock = jest.fn();
    mockWithCtx.mockImplementation((_id: string, cb: (tx: unknown) => unknown) =>
      cb({
        department: { findUnique: jest.fn().mockResolvedValue(null) },
        manager: { update: updateMock },
      }),
    );

    const res = await request(app).patch('/auth/me').send({ deptId: 'foreign-dept' });

    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects a missing deptId with 400', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockFindUnique.mockResolvedValue(managerA);

    const res = await request(app).patch('/auth/me').send({});

    expect(res.status).toBe(400);
    expect(mockWithCtx).not.toHaveBeenCalled();
  });
});
