import request from 'supertest';
import { managerA, hrAdmin } from './helpers';

const mockGetAuth = jest.fn();

jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: unknown) => mockGetAuth(req),
}));

jest.mock('../lib/prisma', () => ({
  prisma: {
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
const mockQueryRaw = prisma.$queryRaw as jest.Mock;
const mockWithManagerContext = withManagerContext as jest.Mock;

const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();
  // The HR aggregators read the SECURITY DEFINER functions through the
  // context transaction; the mock just runs fn against the prisma stub.
  mockWithManagerContext.mockImplementation(async (_id: string, fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
});

describe('GET /hr/flags', () => {
  it('returns org-level flag aggregates with deltas for an hr_admin', async () => {
    mockGetAuth.mockReturnValue({ userId: hrAdmin.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(hrAdmin);

    // aggregateHrFlags runs hr_flag_summary twice — current window, then
    // previous window (for the delta).
    mockQueryRaw
      .mockResolvedValueOnce([
        { flag_type: 'criteria_drift', count: BigInt(11), dismissed: BigInt(1) },
        { flag_type: 'age_bias', count: BigInt(4), dismissed: BigInt(0) },
      ])
      .mockResolvedValueOnce([
        { flag_type: 'criteria_drift', count: BigInt(8), dismissed: BigInt(2) },
        { flag_type: 'age_bias', count: BigInt(2), dismissed: BigInt(0) },
      ]);

    const res = await request(app).get('/hr/flags?period=90d');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      period: '90d',
      total: 15,
      dismissed: 1,
      byType: [
        { type: 'criteria_drift', count: 11, dismissed: 1, delta: 3 },
        { type: 'age_bias', count: 4, dismissed: 0, delta: 2 },
      ],
    });
    // No individual rows / manager identity anywhere in the response.
    expect(JSON.stringify(res.body)).not.toMatch(/managerId|clerkUserId|excerpt|reasoning/);
  });

  it('rejects an invalid period', async () => {
    mockGetAuth.mockReturnValue({ userId: hrAdmin.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(hrAdmin);

    const res = await request(app).get('/hr/flags?period=bogus');

    expect(res.status).toBe(400);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('returns 403 for a regular manager', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);

    const res = await request(app).get('/hr/flags');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
    // Database is never touched when the role check fails.
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});

describe('GET /hr/decisions', () => {
  it('returns org-level decision-outcome aggregates for an hr_admin', async () => {
    mockGetAuth.mockReturnValue({ userId: hrAdmin.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(hrAdmin);

    mockQueryRaw.mockResolvedValueOnce([
      { outcome: 'rejected', count: BigInt(8) },
      { outcome: 'hired', count: BigInt(4) },
    ]);

    const res = await request(app).get('/hr/decisions?period=30d');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      period: '30d',
      total: 12,
      byOutcome: [
        { outcome: 'rejected', count: 8 },
        { outcome: 'hired', count: 4 },
      ],
    });
  });

  it('returns 403 for a regular manager', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);

    const res = await request(app).get('/hr/decisions');

    expect(res.status).toBe(403);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});

describe('GET /hr/demographics', () => {
  it('returns org-level composition by race for an hr_admin', async () => {
    mockGetAuth.mockReturnValue({ userId: hrAdmin.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(hrAdmin);

    mockQueryRaw.mockResolvedValueOnce([
      { race: 'malay', applied: BigInt(5), hired: BigInt(1), rejected: BigInt(3) },
      { race: 'chinese', applied: BigInt(8), hired: BigInt(4), rejected: BigInt(1) },
      { race: 'unknown', applied: BigInt(2), hired: BigInt(0), rejected: BigInt(0) },
    ]);

    const res = await request(app).get('/hr/demographics?period=12m');

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('12m');
    // Canonical race ordering (chinese before malay), 'unknown' last.
    expect(res.body.byRace.map((r: { race: string }) => r.race)).toEqual([
      'chinese',
      'malay',
      'unknown',
    ]);
    expect(res.body.byRace[0]).toMatchObject({
      race: 'chinese',
      applied: 8,
      hired: 4,
      rejected: 1,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/managerId|clerkUserId|excerpt|reasoning/);
  });

  it('returns 403 for a regular manager', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);

    const res = await request(app).get('/hr/demographics');

    expect(res.status).toBe(403);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});

describe('GET /hr/nudges', () => {
  it('returns org-level reflections built from the aggregates for an hr_admin', async () => {
    mockGetAuth.mockReturnValue({ userId: hrAdmin.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(hrAdmin);

    // aggregateHrNudges runs hr_flag_summary twice (current, previous) then
    // hr_demographic_summary once.
    mockQueryRaw
      .mockResolvedValueOnce([
        { flag_type: 'criteria_drift', count: BigInt(12), dismissed: BigInt(9) },
        { flag_type: 'age_bias', count: BigInt(4), dismissed: BigInt(0) },
      ])
      .mockResolvedValueOnce([
        { flag_type: 'criteria_drift', count: BigInt(6), dismissed: BigInt(2) },
        { flag_type: 'age_bias', count: BigInt(4), dismissed: BigInt(0) },
      ])
      .mockResolvedValueOnce([
        { race: 'chinese', applied: BigInt(7), hired: BigInt(9), rejected: BigInt(0) },
        { race: 'malay', applied: BigInt(3), hired: BigInt(1), rejected: BigInt(0) },
      ]);

    const res = await request(app).get('/hr/nudges?period=90d');

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('90d');
    // All four rules fire; the cap is 3 and composition shift (+20pp) ranks first.
    expect(res.body.nudges).toHaveLength(3);
    expect(res.body.nudges[0].id).toBe('hr-composition-shift');
    // Aggregate-only: no manager identity, excerpt, or reasoning anywhere.
    expect(JSON.stringify(res.body)).not.toMatch(/managerId|clerkUserId|excerpt|reasoning/);
  });

  it('rejects an invalid period', async () => {
    mockGetAuth.mockReturnValue({ userId: hrAdmin.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(hrAdmin);

    const res = await request(app).get('/hr/nudges?period=bogus');

    expect(res.status).toBe(400);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('returns 403 for a regular manager', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);

    const res = await request(app).get('/hr/nudges');

    expect(res.status).toBe(403);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
