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
import { systemPrisma } from '../lib/prisma';

const mockOrgFindFirst = systemPrisma.organisation.findFirst as jest.Mock;
const mockDeptFindFirst = systemPrisma.department.findFirst as jest.Mock;
const mockUpsert = systemPrisma.manager.upsert as jest.Mock;
const mockFindUnique = systemPrisma.manager.findUnique as jest.Mock;

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
