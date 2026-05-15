import request from 'supertest';
import { managerA, hrAdmin } from './helpers';

const mockGetAuth = jest.fn();

jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: unknown) => mockGetAuth(req),
}));

jest.mock('../lib/prisma', () => ({
  prisma: {
    meeting: { findMany: jest.fn(), findUnique: jest.fn() },
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
  mockWithManagerContext.mockImplementation(async (_id: string, fn: (tx: unknown) => unknown) =>
    fn(prisma)
  );
});

describe('GET /hr/summary', () => {
  it('returns aggregate counts when the caller is an hr_admin', async () => {
    mockGetAuth.mockReturnValue({ userId: hrAdmin.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(hrAdmin);

    // Four $queryRaw calls in the route, matched in Promise.all order
    mockQueryRaw
      .mockResolvedValueOnce([{ total: BigInt(33), dismissed: BigInt(3) }])
      .mockResolvedValueOnce([{ total: BigInt(12) }])
      .mockResolvedValueOnce([{ flag_type: 'criteria_drift', count: BigInt(11) }])
      .mockResolvedValueOnce([{ outcome: 'rejected', count: BigInt(8) }]);

    const res = await request(app).get('/hr/summary');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      flags: {
        total: 33,
        dismissed: 3,
        byType: [{ type: 'criteria_drift', count: 11 }],
      },
      decisions: {
        total: 12,
        byOutcome: [{ outcome: 'rejected', count: 8 }],
      },
    });
    // Confirm no individual rows are present anywhere in the response body
    expect(JSON.stringify(res.body)).not.toMatch(/managerId|clerkUserId|excerpt|reasoning/);
  });

  it('returns 403 for a regular manager', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);

    const res = await request(app).get('/hr/summary');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
    // Database should never be hit when role check fails
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
