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
  decisions: Array<{
    id: string;
    outcome: 'hired' | 'rejected' | 'in_progress' | 'promoted' | 'held';
    candidateId: string;
  }>;
};

type PreviousFlagCount = { flagType: string; _count: { _all: number } };

type PipelineCandidateFixture = {
  id: string;
  createdAt: Date;
  demographics: { race: string | null } | null;
  meetings: Array<{ meetingId: string }>;
  decisions: Array<{ outcome: 'hired' | 'rejected' | 'in_progress' }>;
};

function makeTx(
  meetings: MeetingFixture[],
  previousFlagCounts: PreviousFlagCount[] = [],
  pipelineCandidates: PipelineCandidateFixture[] = [],
): {
  tx: TransactionClient;
  findMany: jest.Mock;
  groupBy: jest.Mock;
  candidateFindMany: jest.Mock;
} {
  const findMany = jest.fn().mockResolvedValue(meetings);
  const groupBy = jest.fn().mockResolvedValue(previousFlagCounts);
  const candidateFindMany = jest.fn().mockResolvedValue(pipelineCandidates);
  const tx = {
    meeting: { findMany },
    flag: { groupBy },
    candidate: { findMany: candidateFindMany },
  } as unknown as TransactionClient;
  return { tx, findMany, groupBy, candidateFindMany };
}

const baseInput = {
  managerId: 'mgr-1',
  manager: { name: 'Daniel Whittaker', team: 'Group Strategy & Sustainability' },
  period: '90d' as const,
  // Default to hiring — the existing tests were all written against
  // hiring meetings and the meetingType filter wasn't a concept yet.
  // Promotion-specific assertions override this per-test.
  meetingType: 'hiring' as const,
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
  it('returns zeroed summary, no decisions, and empty Phase B/D arrays', async () => {
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
    expect(data.languageFlags).toEqual([]);
    expect(data.nudges).toEqual([]);
  });

  it('returns the 4 pipeline stages with all-zero segments when there are no candidates', async () => {
    const { tx } = makeTx([], [], []);
    const data = await aggregateMirror(tx, baseInput);
    expect(data.pipeline.map((r) => r.stage)).toEqual([
      'Applied',
      'Interviewed',
      'Hired',
      'Rejected',
    ]);
    for (const row of data.pipeline) {
      expect(row.total).toBe(0);
      expect(row.segments).toEqual({
        chinese: 0,
        malay: 0,
        indian: 0,
        other: 0,
        unknown: 0,
      });
    }
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

  it('maps promotion-mode outcomes to Promoted / Held (not Pending)', async () => {
    // Regression: the aggregator used to collapse promoted/held → Pending
    // because it assumed no promotion meetings reached this path. Once the
    // Mirror became mode-aware, that mislabelled every promotion decision.
    const { tx } = makeTx([
      {
        id: 'm1',
        date: new Date('2026-05-25T00:00:00Z'),
        candidates: [
          { candidateId: 'c1', candidate: { name: 'Ada Lim', roleAppliedFor: 'VP' } },
          { candidateId: 'c2', candidate: { name: 'Ben Ng', roleAppliedFor: 'VP' } },
          { candidateId: 'c3', candidate: { name: 'Cai Wei', roleAppliedFor: 'VP' } },
        ],
        flags: [],
        decisions: [
          { id: 'd1', outcome: 'promoted', candidateId: 'c1' },
          { id: 'd2', outcome: 'held', candidateId: 'c2' },
          { id: 'd3', outcome: 'in_progress', candidateId: 'c3' },
        ],
      },
    ]);

    const data = await aggregateMirror(tx, { ...baseInput, meetingType: 'promotion' });
    expect(data.decisions.find((d) => d.id === 'd1')?.outcome).toBe('Promoted');
    expect(data.decisions.find((d) => d.id === 'd2')?.outcome).toBe('Held');
    expect(data.decisions.find((d) => d.id === 'd3')?.outcome).toBe('Pending');
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

  it('passes the previous-window date filter to flag.groupBy', async () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const { tx, groupBy } = makeTx([]);
    await aggregateMirror(tx, { ...baseInput, now });

    const ninetyD = 90 * 24 * 60 * 60 * 1000;
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['flagType'],
        where: expect.objectContaining({
          meeting: expect.objectContaining({
            managerId: 'mgr-1',
            date: {
              gte: new Date(now.getTime() - 2 * ninetyD),
              lte: new Date(now.getTime() - ninetyD),
            },
          }),
        }),
      }),
    );
  });
});

describe('aggregateMirror — languageFlags (Phase B)', () => {
  const meetingDate = new Date('2026-05-25T00:00:00Z');

  function withFlags(currentFlags: Array<{ flagType: string }>): MeetingFixture[] {
    return [
      {
        id: 'm1',
        date: meetingDate,
        candidates: [
          { candidateId: 'c1', candidate: { name: 'A B', roleAppliedFor: 'X' } },
        ],
        flags: currentFlags.map((f) => ({ flagType: f.flagType, dismissed: false })),
        decisions: [],
      },
    ];
  }

  it('builds one row per FlagType that has at least one flag in the current window', async () => {
    const { tx } = makeTx(
      withFlags([
        { flagType: 'age_bias' },
        { flagType: 'age_bias' },
        { flagType: 'hedging_language' },
      ]),
      [
        { flagType: 'age_bias', _count: { _all: 6 } },
        { flagType: 'hedging_language', _count: { _all: 3 } },
      ],
    );

    const data = await aggregateMirror(tx, baseInput);

    expect(data.languageFlags).toHaveLength(2);
    expect(data.languageFlags.map((r) => r.id)).toEqual(['age_bias', 'hedging_language']);
  });

  it('sorts rows by count desc and marks the top row highlight: true', async () => {
    const { tx } = makeTx(
      withFlags([
        { flagType: 'age_bias' },
        { flagType: 'hedging_language' },
        { flagType: 'hedging_language' },
        { flagType: 'hedging_language' },
        { flagType: 'criteria_drift' },
        { flagType: 'criteria_drift' },
      ]),
      // Prior total = 10 → above sparse threshold (5), so deltas are real
      [
        { flagType: 'age_bias', _count: { _all: 5 } },
        { flagType: 'hedging_language', _count: { _all: 5 } },
      ],
    );

    const data = await aggregateMirror(tx, baseInput);

    expect(data.languageFlags.map((r) => r.id)).toEqual([
      'hedging_language',
      'criteria_drift',
      'age_bias',
    ]);
    expect(data.languageFlags[0]?.highlight).toBe(true);
    expect(data.languageFlags[1]?.highlight).toBeUndefined();
    expect(data.languageFlags[2]?.highlight).toBeUndefined();
  });

  it('computes delta as current − previous when prior window has enough flags', async () => {
    const { tx } = makeTx(
      withFlags([
        { flagType: 'age_bias' },
        { flagType: 'age_bias' },
        { flagType: 'age_bias' },
      ]),
      // Prior total = 6 → above sparse threshold
      [
        { flagType: 'age_bias', _count: { _all: 6 } },
      ],
    );

    const data = await aggregateMirror(tx, baseInput);
    expect(data.languageFlags[0]).toMatchObject({
      id: 'age_bias',
      count: 3,
      delta: -3, // 3 − 6
    });
  });

  it('sets delta: null on every row when the prior window has fewer than the sparse threshold of flags', async () => {
    const { tx } = makeTx(
      withFlags([
        { flagType: 'age_bias' },
        { flagType: 'age_bias' },
        { flagType: 'hedging_language' },
      ]),
      // Prior total = 4 → below threshold (5), so delta is null for all
      [
        { flagType: 'age_bias', _count: { _all: 4 } },
      ],
    );

    const data = await aggregateMirror(tx, baseInput);
    expect(data.languageFlags.every((r) => r.delta === null)).toBe(true);
  });

  it('returns an empty languageFlags array when no flags exist in either window', async () => {
    const { tx } = makeTx([], []);
    const data = await aggregateMirror(tx, baseInput);
    expect(data.languageFlags).toEqual([]);
  });

  it('uses FLAG_TYPE_LABELS for the row label', async () => {
    const { tx } = makeTx(
      withFlags([{ flagType: 'age_bias' }]),
      [],
    );
    const data = await aggregateMirror(tx, baseInput);
    expect(data.languageFlags[0]?.label).toBe('Energy / pace language');
  });

  it('treats a FlagType that fired in current but not in previous as delta = current (when above threshold)', async () => {
    const { tx } = makeTx(
      withFlags([
        { flagType: 'criteria_drift' },
        { flagType: 'criteria_drift' },
      ]),
      // Prior total = 6 → above threshold; criteria_drift didn't fire previously
      [{ flagType: 'age_bias', _count: { _all: 6 } }],
    );

    const data = await aggregateMirror(tx, baseInput);
    const row = data.languageFlags.find((r) => r.id === 'criteria_drift');
    expect(row?.delta).toBe(2); // 2 − 0
  });
});

describe('aggregateMirror — pipeline (Phase C)', () => {
  // Anchor candidate-created dates inside the 90d default window so the
  // Applied-stage date check passes (now − 90d ≤ createdAt ≤ now).
  const within = new Date('2026-05-15T00:00:00Z');

  function pc(
    id: string,
    overrides: Partial<PipelineCandidateFixture> = {},
  ): PipelineCandidateFixture {
    return {
      id,
      createdAt: within,
      demographics: null,
      meetings: [],
      decisions: [],
      ...overrides,
    };
  }

  it('buckets each candidate into every stage they qualify for', async () => {
    const { tx } = makeTx(
      [],
      [],
      [
        // Applied-only — has a createdAt in window, no meetings, no decisions
        pc('appliedOnly', { demographics: { race: 'chinese' } }),
        // Applied + Interviewed
        pc('interviewed', {
          demographics: { race: 'malay' },
          meetings: [{ meetingId: 'm1' }],
        }),
        // Applied + Interviewed + Hired
        pc('hired', {
          demographics: { race: 'indian' },
          meetings: [{ meetingId: 'm2' }],
          decisions: [{ outcome: 'hired' }],
        }),
        // Applied + Interviewed + Rejected
        pc('rejected', {
          demographics: { race: 'other' },
          meetings: [{ meetingId: 'm3' }],
          decisions: [{ outcome: 'rejected' }],
        }),
      ],
    );

    const data = await aggregateMirror(tx, baseInput);

    const byStage = Object.fromEntries(data.pipeline.map((r) => [r.stage, r]));
    expect(byStage.Applied?.total).toBe(4); // all four created in window
    expect(byStage.Interviewed?.total).toBe(3);
    expect(byStage.Hired?.total).toBe(1);
    expect(byStage.Rejected?.total).toBe(1);

    // Race breakdowns: each candidate contributes to the segment of their race
    expect(byStage.Applied?.segments.chinese).toBe(1);
    expect(byStage.Applied?.segments.malay).toBe(1);
    expect(byStage.Interviewed?.segments.indian).toBe(1);
    expect(byStage.Hired?.segments.indian).toBe(1);
    expect(byStage.Rejected?.segments.other).toBe(1);
  });

  it('buckets candidates with no demographics row into the unknown segment', async () => {
    const { tx } = makeTx(
      [],
      [],
      [
        pc('noDemo1', { demographics: null }),
        pc('noDemo2', { demographics: null, meetings: [{ meetingId: 'm1' }] }),
      ],
    );

    const data = await aggregateMirror(tx, baseInput);
    const applied = data.pipeline.find((r) => r.stage === 'Applied');
    const interviewed = data.pipeline.find((r) => r.stage === 'Interviewed');
    expect(applied?.segments.unknown).toBe(2);
    expect(interviewed?.segments.unknown).toBe(1);
  });

  it('buckets candidates with race: null into the unknown segment', async () => {
    const { tx } = makeTx(
      [],
      [],
      [pc('nullRace', { demographics: { race: null } })],
    );

    const data = await aggregateMirror(tx, baseInput);
    expect(data.pipeline.find((r) => r.stage === 'Applied')?.segments.unknown).toBe(1);
  });

  it('does not count a candidate as Applied if their createdAt falls outside the current window', async () => {
    const { tx } = makeTx(
      [],
      [],
      [
        // Created 200 days ago — outside the default 90d window. But still
        // returned by findMany because they had an in-window meeting.
        pc('oldCand', {
          createdAt: new Date('2025-11-01T00:00:00Z'),
          demographics: { race: 'chinese' },
          meetings: [{ meetingId: 'm1' }],
        }),
      ],
    );

    const data = await aggregateMirror(tx, baseInput);
    expect(data.pipeline.find((r) => r.stage === 'Applied')?.total).toBe(0);
    expect(data.pipeline.find((r) => r.stage === 'Interviewed')?.total).toBe(1);
  });

  it('passes the correct OR-leg filters and select shape to candidate.findMany', async () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const { tx, candidateFindMany } = makeTx([], [], []);
    await aggregateMirror(tx, { ...baseInput, now });

    const call = candidateFindMany.mock.calls[0]?.[0];
    expect(call.where.deletedAt).toBeNull();
    expect(call.where.OR).toHaveLength(3);
    // Includes must scope to this manager within the same window so
    // out-of-window meetings/decisions don't leak into the bucket count.
    expect(call.select.meetings.where.meeting.managerId).toBe('mgr-1');
    expect(call.select.decisions.where.managerId).toBe('mgr-1');
  });

  it('totals always equal the sum of segments', async () => {
    const { tx } = makeTx(
      [],
      [],
      [
        pc('a', { demographics: { race: 'chinese' } }),
        pc('b', { demographics: { race: 'malay' }, meetings: [{ meetingId: 'm' }] }),
        pc('c', { demographics: null, decisions: [{ outcome: 'hired' }] }),
      ],
    );
    const data = await aggregateMirror(tx, baseInput);
    for (const row of data.pipeline) {
      const sum =
        row.segments.chinese +
        row.segments.malay +
        row.segments.indian +
        row.segments.other +
        row.segments.unknown;
      expect(row.total).toBe(sum);
    }
  });
});
