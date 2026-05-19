const mockAnalyse = jest.fn();

jest.mock('../analysis/HybridRouter', () => ({
  HybridRouter: jest.fn().mockImplementation(() => ({
    analyse: mockAnalyse,
    modelVersion: 'test-model',
  })),
}));

jest.mock('../lib/prisma', () => ({
  systemPrisma: {
    analysisRun: { findUnique: jest.fn(), updateMany: jest.fn() },
  },
  withManagerContext: jest.fn(),
}));

import { runAnalysis } from '../analysis/analyseTranscript';
import { systemPrisma, withManagerContext } from '../lib/prisma';

const mockFindUnique = jest.mocked(systemPrisma.analysisRun.findUnique);
const mockWithCtx = jest.mocked(withManagerContext);

const meeting = { id: 'm1', orgId: 'o1', managerId: 'mgr1', transcript: 'some transcript' };

function makeTx(claimCount: number, finaliseCount: number) {
  const updateMany = jest
    .fn()
    .mockResolvedValueOnce({ count: claimCount })
    .mockResolvedValueOnce({ count: finaliseCount });
  const createMany = jest.fn().mockResolvedValue({ count: 1 });
  return { tx: { analysisRun: { updateMany }, flag: { createMany } }, updateMany, createMany };
}

describe('runAnalysis — atomic status guard', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockWithCtx.mockReset();
    mockAnalyse.mockReset();
  });

  it('claims a pending run, analyses, writes flags, completes', async () => {
    mockFindUnique.mockResolvedValue({ status: 'pending', meeting } as never);
    mockAnalyse.mockResolvedValue({
      flags: [{ flagType: 'age_bias', excerpt: 'x', reasoning: 'y', confidenceScore: 0.9 }],
      llmOk: true,
    });
    const { tx, createMany } = makeTx(1, 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithCtx.mockImplementation(async (_id: string, cb: any) => cb(tx));

    await runAnalysis('run1');

    expect(mockAnalyse).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledTimes(1);
  });

  it('no-ops when the run is not pending (double-trigger / already terminal)', async () => {
    mockFindUnique.mockResolvedValue({ status: 'completed', meeting } as never);
    const { tx, createMany } = makeTx(0, 0); // claim matches 0 rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithCtx.mockImplementation(async (_id: string, cb: any) => cb(tx));

    await runAnalysis('run1');

    expect(mockAnalyse).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it('discards its result (no flags) when another path finalised the run mid-analysis', async () => {
    mockFindUnique.mockResolvedValue({ status: 'pending', meeting } as never);
    mockAnalyse.mockResolvedValue({
      flags: [{ flagType: 'age_bias', excerpt: 'x', reasoning: 'y', confidenceScore: 0.9 }],
      llmOk: true,
    });
    const { tx, createMany } = makeTx(1, 0); // claim wins, finalise loses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithCtx.mockImplementation(async (_id: string, cb: any) => cb(tx));

    await runAnalysis('run1');

    expect(mockAnalyse).toHaveBeenCalledTimes(1);
    expect(createMany).not.toHaveBeenCalled();
  });
});
