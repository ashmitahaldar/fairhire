import { aggregateMirror, getPeriodWindows } from '../aggregator';
import type { TransactionClient } from '../../lib/prisma';

// Unit tests for the Pattern Mirror aggregator. Mocks the Prisma findMany
// return shape directly so we can exercise the math without a DB. Phase A
// only — pipeline/languageFlags/nudges are still stubs and just asserted
// to come back as empty arrays.

type MeetingFixture = {
  id: string;
  date: Date;
  candidates: Array<{
    candidateId: string;
    candidate: { name: string; roleAppliedFor: string };
  }>;
  flags: Array<{ flagType: string; dismissed: boolean }>;
  decisions: Array<{ id: string; outcome: 'hired' | 'rejected' | 'in_progress'; candidateId: string }>;
};

function makeTx(meetings: MeetingFixture[]): {
  tx: TransactionClient;
  findMany: jest.Mock;
} {
  const findMany = jest.fn().mockResolvedValue(meetings);
  const tx = { meeting: { findMany } } as unknown as TransactionClient;
  return { tx, findMany };
}

const baseInput = {
  managerId: 'mgr-1',
  manager: { name: 'Daniel Whittaker', team: 'Group Strategy & Sustainability' },
  period: '90d' as const,
  now: new Date('2026-06-01T12:00:00Z'),
};

describe('getPeriodWindows', () => {
  const now = new Date('2026-06-01T12:00:00Z');

  it('30d → 30-day current and 30-day previous, no overlap', () => {
    const w = getPeriodWindows('30d', now);
    expect(w.current.end).toEqual(now);
    expect(w.current.start.getTime()).toBe(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(w.previous.end).toEqual(w.current.start);
    expect(w.previous.start.getTime()).toBe(w.current.start.getTime() - 30 * 24 * 60 * 60 * 1000);
  });

  it('90d → 90-day windows', () => {
    const w = getPeriodWindows('90d', now);
    const ninetyD = 90 * 24 * 60 * 60 * 1000;
    expect(w.current.end.getTime() - w.current.start.getTime()).toBe(ninetyD);
    expect(w.previous.end.getTime() - w.previous.start.getTime()).toBe(ninetyD);
  });

  it('12m → 365-day windows', () => {
    const w = getPeriodWindows('12m', now);
    const yr = 365 * 24 * 60 * 60 * 1000;
    expect(w.current.end.getTime() - w.current.start.getTime()).toBe(yr);
  });
});

describe('aggregateMirror — empty manager', () => {
  it('returns zeroed summary, no decisions, and empty B/C/D arrays', async () => {
    const { tx } = makeTx([]);
    const data = await aggregateMirror(tx, baseInput);

    expect(data.summary).toEqual({
      interviewsCount: 0,
      rolesCount: 0,
      topCategory: '—',
      topCategoryCount: 0,
      avgFlagsPerInterview: 0,
      dismissedFlags: 0,
      totalFlags: 0,
    });
    expect(data.decisions).toEqual([]);
    expect(data.recentDecisions).toEqual([]);
    expect(data.pipeline).toEqual([]);
    expect(data.languageFlags).toEqual([]);
    expect(data.nudges).toEqual([]);
  });

  it('still returns the manager header and period metadata', async () => {
    const { tx } = makeTx([]);
    const data = await aggregateMirror(tx, baseInput);
    expect(data.manager).toEqual({
      name: 'Daniel Whittaker',
      team: 'Group Strategy & Sustainability',
      initials: 'DW',
    });
    expect(data.periodKey).toBe('90d');
    expect(data.period).toBe('Last 90 days');
    expect(data.periodOptions).toContain('Last 90 days');
  });
});

describe('aggregateMirror — summary math', () => {
  const m1Date = new Date('2026-05-25T00:00:00Z'); // 7 days ago
  const m2Date = new Date('2026-05-10T00:00:00Z'); // 22 days ago

  it('counts interviews, unique roles, total + dismissed flags', async () => {
    const { tx } = makeTx([
      {
        id: 'm1',
        date: m1Date,
        candidates: [
          { candidateId: 'c1', candidate: { name: 'Ahmad Faris', roleAppliedFor: 'Analyst' } },
        ],
        flags: [
          { flagType: 'age_bias', dismissed: false },
          { flagType: 'age_bias', dismissed: true },
          { flagType: 'hedging_language', dismissed: false },
        ],
        decisions: [],
      },
      {
        id: 'm2',
        date: m2Date,
        candidates: [
          { candidateId: 'c2', candidate: { name: 'Siti Nurhaliza', roleAppliedFor: 'Director' } },
          { candidateId: 'c3', candidate: { name: 'Kevin Tan', roleAppliedFor: 'Analyst' } },
        ],
        flags: [{ flagType: 'criteria_drift', dismissed: false }],
        decisions: [],
      },
    ]);

    const data = await aggregateMirror(tx, baseInput);

    expect(data.summary.interviewsCount).toBe(2);
    // 'Analyst' shared across two candidates collapses to 1; 'Director' is the second
    expect(data.summary.rolesCount).toBe(2);
    expect(data.summary.totalFlags).toBe(4);
    expect(data.summary.dismissedFlags).toBe(1);
    expect(data.summary.avgFlagsPerInterview).toBe(2);
  });

  it('topCategory is the FlagType with the highest count, mapped via FLAG_TYPE_LABELS', async () => {
    const { tx } = makeTx([
      {
        id: 'm1',
        date: m1Date,
        candidates: [
          { candidateId: 'c1', candidate: { name: 'Ahmad Faris', roleAppliedFor: 'Analyst' } },
        ],
        // age_bias dominates 3:1 over hedging_language
        flags: [
          { flagType: 'age_bias', dismissed: false },
          { flagType: 'age_bias', dismissed: false },
          { flagType: 'age_bias', dismissed: false },
          { flagType: 'hedging_language', dismissed: false },
        ],
        decisions: [],
      },
    ]);

    const data = await aggregateMirror(tx, baseInput);
    expect(data.summary.topCategory).toBe('Energy / pace language');
    expect(data.summary.topCategoryCount).toBe(3);
  });

  it('avgFlagsPerInterview rounds to one decimal', async () => {
    const { tx } = makeTx([
      {
        id: 'm1',
        date: m1Date,
        candidates: [
          { candidateId: 'c1', candidate: { name: 'A B', roleAppliedFor: 'X' } },
        ],
        flags: [{ flagType: 'age_bias', dismissed: false }],
        decisions: [],
      },
      {
        id: 'm2',
        date: m2Date,
        candidates: [
          { candidateId: 'c2', candidate: { name: 'C D', roleAppliedFor: 'Y' } },
        ],
        flags: [
          { flagType: 'age_bias', dismissed: false },
          { flagType: 'age_bias', dismissed: false },
        ],
        decisions: [],
      },
    ]);

    const data = await aggregateMirror(tx, baseInput);
    // 3 flags across 2 interviews → 1.5
    expect(data.summary.avgFlagsPerInterview).toBe(1.5);
  });
});

describe('aggregateMirror — decisions mapping', () => {
  it('maps each decision to a MirrorDecision row with outcome, daysAgo, and split name', async () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const meetingDate = new Date('2026-05-25T12:00:00Z'); // exactly 7 days ago
    const { tx } = makeTx([
      {
        id: 'm1',
        date: meetingDate,
        candidates: [
          { candidateId: 'c1', candidate: { name: 'Ahmad Faris', roleAppliedFor: 'Analyst' } },
          { candidateId: 'c2', candidate: { name: 'Siti Nurhaliza', roleAppliedFor: 'Director' } },
        ],
        flags: [
          { flagType: 'age_bias', dismissed: false },
          { flagType: 'age_bias', dismissed: false },
        ],
        decisions: [
          { id: 'd1', outcome: 'hired', candidateId: 'c1' },
          { id: 'd2', outcome: 'in_progress', candidateId: 'c2' },
        ],
      },
    ]);

    const data = await aggregateMirror(tx, { ...baseInput, now });
    expect(data.decisions).toHaveLength(2);

    const d1 = data.decisions.find((d) => d.id === 'd1');
    expect(d1).toMatchObject({
      candidate: 'Ahmad',
      surname: 'Faris',
      role: 'Analyst',
      outcome: 'Hired',
      flags: 2,
      daysAgo: 7,
    });

    const d2 = data.decisions.find((d) => d.id === 'd2');
    expect(d2?.outcome).toBe('Pending');
  });

  it('maps rejected → Declined', async () => {
    const { tx } = makeTx([
      {
        id: 'm1',
        date: new Date('2026-05-25T00:00:00Z'),
        candidates: [
          { candidateId: 'c1', candidate: { name: 'Foo Bar', roleAppliedFor: 'X' } },
        ],
        flags: [],
        decisions: [{ id: 'd1', outcome: 'rejected', candidateId: 'c1' }],
      },
    ]);
    const data = await aggregateMirror(tx, baseInput);
    expect(data.decisions[0]?.outcome).toBe('Declined');
  });

  it('recentDecisions is the same data sorted by daysAgo asc, capped at 8', async () => {
    // Build 10 meetings each with one decision, dates increasingly old
    const meetings: MeetingFixture[] = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i + 1}`,
      date: new Date(2026, 5, 1 - i),
      candidates: [
        { candidateId: `c${i + 1}`, candidate: { name: `Person ${i + 1}`, roleAppliedFor: 'Analyst' } },
      ],
      flags: [],
      decisions: [{ id: `d${i + 1}`, outcome: 'in_progress', candidateId: `c${i + 1}` }],
    }));
    const { tx } = makeTx(meetings);

    const data = await aggregateMirror(tx, { ...baseInput, now: new Date('2026-06-02T00:00:00Z') });

    expect(data.decisions).toHaveLength(10);
    expect(data.recentDecisions).toHaveLength(8);
    // Sorted by daysAgo asc — newest first
    const daysAgos = data.recentDecisions.map((d) => d.daysAgo);
    expect([...daysAgos].sort((a, b) => a - b)).toEqual(daysAgos);
  });
});

describe('aggregateMirror — query filter', () => {
  it('passes the correct managerId and current-window date filter to findMany', async () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const { tx, findMany } = makeTx([]);
    await aggregateMirror(tx, { ...baseInput, now });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          managerId: 'mgr-1',
          date: {
            gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
            lte: now,
          },
        }),
      }),
    );
  });
});
