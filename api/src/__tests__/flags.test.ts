import request from 'supertest';
import { managerA, managerB } from './helpers';

const mockGetAuth = jest.fn();

jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: unknown) => mockGetAuth(req),
}));

jest.mock('../lib/prisma', () => ({
  prisma: {
    flag: { findMany: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn(),
  },
  systemPrisma: {
    manager: { findUnique: jest.fn() },
    // requireOwnership('flag') walks systemPrisma.flag.findUnique to
    // resolve the parent meeting's manager — this is the auth gate.
    flag: { findUnique: jest.fn() },
  },
  withManagerContext: jest.fn(),
}));

import { createApp } from '../app';
import { prisma, systemPrisma, withManagerContext } from '../lib/prisma';

const mockSystemManagerFindUnique = systemPrisma.manager.findUnique as jest.Mock;
const mockSystemFlagFindUnique = systemPrisma.flag.findUnique as jest.Mock;
const mockFlagUpdate = prisma.flag.update as jest.Mock;
const mockWithManagerContext = withManagerContext as jest.Mock;

const app = createApp();
const FLAG_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  jest.clearAllMocks();
  mockWithManagerContext.mockImplementation(async (_id: string, fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
});

describe('PATCH /flags/:id — set or clear dismissed', () => {
  it('dismisses with a reason and stamps the actor + timestamp', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockSystemFlagFindUnique.mockResolvedValue({ meeting: { managerId: managerA.id } });
    mockFlagUpdate.mockResolvedValue({ id: FLAG_ID, dismissed: true });

    const res = await request(app)
      .patch(`/flags/${FLAG_ID}`)
      .send({ dismissed: true, dismissReason: 'Acknowledged' });

    expect(res.status).toBe(200);
    expect(mockFlagUpdate).toHaveBeenCalledWith({
      where: { id: FLAG_ID },
      data: expect.objectContaining({
        dismissed: true,
        dismissReason: 'Acknowledged',
        dismissedBy: managerA.id,
      }),
    });
    // Stamp present + plausible
    const call = mockFlagUpdate.mock.calls[0][0];
    expect(call.data.dismissedAt).toBeInstanceOf(Date);
  });

  it('accepts the legacy bare-reason shape and treats it as dismiss=true', async () => {
    // Pre-Week-5 callers didn't send the `dismissed` boolean. The Zod
    // union's transform branch keeps them working.
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockSystemFlagFindUnique.mockResolvedValue({ meeting: { managerId: managerA.id } });
    mockFlagUpdate.mockResolvedValue({ id: FLAG_ID, dismissed: true });

    const res = await request(app)
      .patch(`/flags/${FLAG_ID}`)
      .send({ dismissReason: 'Already addressed' });

    expect(res.status).toBe(200);
    expect(mockFlagUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dismissed: true, dismissReason: 'Already addressed' }),
      }),
    );
  });

  it('undoes a dismissal without requiring a reason and clears the stamps', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockSystemFlagFindUnique.mockResolvedValue({ meeting: { managerId: managerA.id } });
    mockFlagUpdate.mockResolvedValue({ id: FLAG_ID, dismissed: false });

    const res = await request(app)
      .patch(`/flags/${FLAG_ID}`)
      .send({ dismissed: false });

    expect(res.status).toBe(200);
    expect(mockFlagUpdate).toHaveBeenCalledWith({
      where: { id: FLAG_ID },
      data: {
        dismissed: false,
        dismissReason: null,
        dismissedAt: null,
        dismissedBy: null,
      },
    });
  });

  it('returns 400 when dismissing without a reason', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockSystemFlagFindUnique.mockResolvedValue({ meeting: { managerId: managerA.id } });

    const res = await request(app)
      .patch(`/flags/${FLAG_ID}`)
      .send({ dismissed: true });

    expect(res.status).toBe(400);
    expect(mockFlagUpdate).not.toHaveBeenCalled();
  });

  it('returns 403 when the flag belongs to another manager', async () => {
    mockGetAuth.mockReturnValue({ userId: managerA.clerkUserId });
    mockSystemManagerFindUnique.mockResolvedValue(managerA);
    mockSystemFlagFindUnique.mockResolvedValue({ meeting: { managerId: managerB.id } });

    const res = await request(app)
      .patch(`/flags/${FLAG_ID}`)
      .send({ dismissed: false });

    expect(res.status).toBe(403);
    expect(mockFlagUpdate).not.toHaveBeenCalled();
  });
});
