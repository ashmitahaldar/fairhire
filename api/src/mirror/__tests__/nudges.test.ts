import { buildNudges, type NudgeInputs } from '../nudges';
import type {
  LanguageFlagRow,
  MirrorDecision,
  MirrorSummary,
  PipelineRow,
  RaceSegmentKey,
} from '@fairhire/shared';

// Synthetic-input unit tests for each Phase D rule. The orchestrator
// is also covered: severity-desc sort + 3-cap. All rules fire on
// Phase A+B aggregates only — no Prisma involved.

const baselineSummary: MirrorSummary = {
  interviewsCount: 0,
  rolesCount: 0,
  topCategory: '—',
  topCategoryCount: 0,
  avgFlagsPerInterview: 0,
  dismissedFlags: 0,
  totalFlags: 0,
};

function inputs(over: Partial<NudgeInputs> = {}): NudgeInputs {
  return {
    summary: baselineSummary,
    languageFlags: [],
    decisions: [],
    pipeline: [],
    meetingType: 'hiring',
    ...over,
  };
}

// Convenience helper for Phase C tests. Builds a PipelineRow with the
// segments map filled out from named groups; unspecified segments
// default to 0.
function stage(
  stageName: string,
  segments: Partial<Record<RaceSegmentKey, number>>,
): PipelineRow {
  const full: Record<RaceSegmentKey, number> = {
    chinese: 0,
    malay: 0,
    indian: 0,
    other: 0,
    unknown: 0,
    ...segments,
  };
  const total = Object.values(full).reduce((s, n) => s + n, 0);
  return { stage: stageName, segments: full, total };
}

function lang(
  id: string,
  label: string,
  count: number,
  delta: number | null,
): LanguageFlagRow {
  return { id: id as LanguageFlagRow['id'], label, count, delta };
}

function dec(outcome: MirrorDecision['outcome'], i = 0): MirrorDecision {
  return {
    id: `d${i}`,
    date: 'May 1',
    candidate: 'A',
    surname: 'B',
    role: 'Analyst',
    flags: 0,
    outcome,
    daysAgo: i,
  };
}

describe('Rule 1 — top category dominance', () => {
  it('fires when top is ≥2× the next-most-flagged and absolute count ≥4', () => {
    const out = buildNudges(
      inputs({
        summary: {
          ...baselineSummary,
          topCategory: 'Energy / pace language',
          topCategoryCount: 8,
        },
        languageFlags: [lang('age_bias', 'Energy / pace language', 8, 0), lang('hedging_language', 'Hedging', 3, 0)],
      }),
    );
    const n = out.find((x) => x.id === 'top-category-dominance');
    expect(n).toBeTruthy();
    expect(n!.sentence).toContain('Energy / pace language');
    expect(n!.sentence).toContain('3×');
  });

  it('does not fire below the 2× ratio threshold', () => {
    const out = buildNudges(
      inputs({
        summary: { ...baselineSummary, topCategory: 'X', topCategoryCount: 5 },
        languageFlags: [lang('age_bias', 'X', 5, 0), lang('hedging_language', 'Y', 4, 0)],
      }),
    );
    expect(out.find((x) => x.id === 'top-category-dominance')).toBeUndefined();
  });

  it('does not fire below the absolute count floor', () => {
    // 3 vs 1 is 3× but top count is below the floor of 4
    const out = buildNudges(
      inputs({
        summary: { ...baselineSummary, topCategory: 'X', topCategoryCount: 3 },
        languageFlags: [lang('age_bias', 'X', 3, 0), lang('hedging_language', 'Y', 1, 0)],
      }),
    );
    expect(out.find((x) => x.id === 'top-category-dominance')).toBeUndefined();
  });
});

describe('Rule 2 — category surging', () => {
  it('fires on a row with delta ≥ +50% of prior and count ≥ floor', () => {
    // current 9, delta +4 → prior 5, relative surge 0.8 → ≥0.5 threshold
    const out = buildNudges(
      inputs({
        languageFlags: [lang('age_bias', 'Energy', 9, 4)],
      }),
    );
    const n = out.find((x) => x.id === 'category-surging');
    expect(n).toBeTruthy();
    expect(n!.sentence).toContain('Energy');
    expect(n!.sentence).toContain('up 4');
  });

  it('does not fire when delta is null (sparse prior window)', () => {
    const out = buildNudges(
      inputs({ languageFlags: [lang('age_bias', 'Energy', 9, null)] }),
    );
    expect(out.find((x) => x.id === 'category-surging')).toBeUndefined();
  });

  it('does not fire when current count is below the floor', () => {
    // count 4 < NUDGE_DELTA_SURGE_MIN_COUNT (5)
    const out = buildNudges(
      inputs({ languageFlags: [lang('age_bias', 'Energy', 4, 3)] }),
    );
    expect(out.find((x) => x.id === 'category-surging')).toBeUndefined();
  });

  it('picks the row with the largest relative surge when multiple qualify', () => {
    const out = buildNudges(
      inputs({
        languageFlags: [
          lang('age_bias', 'A', 6, 2), // relative 0.5
          lang('hedging_language', 'B', 8, 5), // relative 5/3 ≈ 1.67
        ],
      }),
    );
    const n = out.find((x) => x.id === 'category-surging');
    expect(n!.sentence).toContain('B');
  });
});

describe('Rule 3 — high dismissal rate', () => {
  it('fires when dismissed/total ≥ 60% and total ≥ floor', () => {
    const out = buildNudges(
      inputs({
        summary: { ...baselineSummary, totalFlags: 10, dismissedFlags: 7 },
      }),
    );
    const n = out.find((x) => x.id === 'high-dismissal-rate');
    expect(n).toBeTruthy();
    expect(n!.sentence).toContain('70%');
    expect(n!.sentence).toContain('7 of 10');
  });

  it('does not fire below the totalFlags floor even at high rate', () => {
    const out = buildNudges(
      inputs({
        summary: { ...baselineSummary, totalFlags: 5, dismissedFlags: 5 },
      }),
    );
    expect(out.find((x) => x.id === 'high-dismissal-rate')).toBeUndefined();
  });

  it('does not fire below the 60% rate', () => {
    const out = buildNudges(
      inputs({
        summary: { ...baselineSummary, totalFlags: 20, dismissedFlags: 10 },
      }),
    );
    expect(out.find((x) => x.id === 'high-dismissal-rate')).toBeUndefined();
  });
});

describe('Rule 4 — decisions skewing', () => {
  it('fires when ≥70% of final decisions are one outcome and total ≥ floor', () => {
    const decisions: MirrorDecision[] = [
      dec('Declined', 0),
      dec('Declined', 1),
      dec('Declined', 2),
      dec('Declined', 3),
      dec('Hired', 4),
      dec('Pending', 5), // excluded from final count
    ];
    const out = buildNudges(inputs({ decisions }));
    const n = out.find((x) => x.id === 'decisions-skewing');
    expect(n).toBeTruthy();
    // 4/5 = 80% Declined
    expect(n!.sentence).toContain('80%');
    expect(n!.sentence).toContain('Declined');
  });

  it('does not fire below the 70% skew threshold', () => {
    const decisions: MirrorDecision[] = [
      dec('Hired', 0),
      dec('Hired', 1),
      dec('Hired', 2),
      dec('Declined', 3),
      dec('Declined', 4),
    ];
    const out = buildNudges(inputs({ decisions }));
    expect(out.find((x) => x.id === 'decisions-skewing')).toBeUndefined();
  });

  it('does not fire below the final-decisions floor (Pending excluded from count)', () => {
    const decisions: MirrorDecision[] = [
      dec('Hired', 0),
      dec('Hired', 1),
      dec('Hired', 2),
      dec('Pending', 3),
      dec('Pending', 4),
    ];
    // Only 3 final → below NUDGE_DECISION_SKEW_MIN_TOTAL (5)
    const out = buildNudges(inputs({ decisions }));
    expect(out.find((x) => x.id === 'decisions-skewing')).toBeUndefined();
  });
});

describe('Rule 5 — high avg flags per interview', () => {
  it('fires when avg ≥ 3 and interviews ≥ floor', () => {
    const out = buildNudges(
      inputs({
        summary: { ...baselineSummary, interviewsCount: 5, avgFlagsPerInterview: 4.2 },
      }),
    );
    const n = out.find((x) => x.id === 'high-avg-flags');
    expect(n).toBeTruthy();
    expect(n!.sentence).toContain('4.2');
    expect(n!.sentence).toContain('across 5');
  });

  it('does not fire below the interviews floor', () => {
    const out = buildNudges(
      inputs({
        summary: { ...baselineSummary, interviewsCount: 2, avgFlagsPerInterview: 5 },
      }),
    );
    expect(out.find((x) => x.id === 'high-avg-flags')).toBeUndefined();
  });

  it('does not fire below the avg threshold', () => {
    const out = buildNudges(
      inputs({
        summary: { ...baselineSummary, interviewsCount: 5, avgFlagsPerInterview: 2.5 },
      }),
    );
    expect(out.find((x) => x.id === 'high-avg-flags')).toBeUndefined();
  });
});

describe('orchestrator — severity sort + 3-cap', () => {
  it('returns at most 3 nudges even when more rules fire', () => {
    const out = buildNudges(
      inputs({
        summary: {
          ...baselineSummary,
          topCategory: 'Energy',
          topCategoryCount: 12, // → dominance fires
          totalFlags: 20,
          dismissedFlags: 16, // → dismissal fires (80%)
          interviewsCount: 5,
          avgFlagsPerInterview: 4, // → high-avg fires
        },
        languageFlags: [
          lang('age_bias', 'Energy', 12, 8), // → surging fires (relative 8/4 = 2.0)
          lang('hedging_language', 'Hedging', 3, 0),
        ],
        decisions: [
          dec('Hired', 0),
          dec('Hired', 1),
          dec('Hired', 2),
          dec('Hired', 3),
          dec('Declined', 4), // → skewing fires (80% Hired)
        ],
      }),
    );
    expect(out).toHaveLength(3);
  });

  it('orders by severity desc when multiple fire', () => {
    // dominance severity = ratio (4), surging severity = relative surge (2.0),
    // dismissal severity = 0.8, skewing severity = 0.8, avg severity = 4
    const out = buildNudges(
      inputs({
        summary: {
          ...baselineSummary,
          topCategory: 'X',
          topCategoryCount: 8,
          totalFlags: 10,
          dismissedFlags: 8,
        },
        languageFlags: [lang('age_bias', 'X', 8, 0), lang('hedging_language', 'Y', 2, 0)],
      }),
    );
    // dominance ratio = 4 > dismissal rate = 0.8, so dominance comes first
    expect(out[0]?.id).toBe('top-category-dominance');
  });

  it('returns an empty array when no rule fires (empty inputs)', () => {
    expect(buildNudges(inputs())).toEqual([]);
  });
});

// ── Phase C: stage drop-off gap ────────────────────────────────────────
describe('Rule 6 — stage drop-off gap (Phase C, hiring only)', () => {
  it('fires when represented drops off ≥10pp more than majority', () => {
    // Applied: 20 majority, 20 represented (both above the 10-per-group floor).
    // Interviewed: 18 majority (10% drop), 10 represented (50% drop) →
    // gap = 40pp, well above the 10pp threshold.
    const out = buildNudges(
      inputs({
        pipeline: [
          stage('Applied', { chinese: 20, malay: 10, indian: 6, other: 4 }),
          stage('Interviewed', { chinese: 18, malay: 5, indian: 3, other: 2 }),
          stage('Hired', { chinese: 5, malay: 1 }),
          stage('Rejected', {}),
        ],
      }),
    );
    const fired = out.find((n) => n.id === 'phase-c-stage-dropoff');
    expect(fired).toBeTruthy();
    expect(fired!.sentence).toContain('Applied and Interviewed');
    expect(fired!.sentence).toMatch(/\d+pp gap/);
    expect(fired!.linkTo).toBe('Demographics');
  });

  it('does not fire when either group has fewer than 10 candidates at the from-stage', () => {
    // Represented only has 8 at Applied — below the per-group floor.
    const out = buildNudges(
      inputs({
        pipeline: [
          stage('Applied', { chinese: 20, malay: 4, indian: 2, other: 2 }),
          stage('Interviewed', { chinese: 18, malay: 0 }),
          stage('Hired', {}),
          stage('Rejected', {}),
        ],
      }),
    );
    expect(out.some((n) => n.id === 'phase-c-stage-dropoff')).toBe(false);
  });

  it('does not fire when the gap is below 10pp', () => {
    // Both groups drop ~10%, gap is near zero.
    const out = buildNudges(
      inputs({
        pipeline: [
          stage('Applied', { chinese: 20, malay: 10, indian: 6, other: 4 }),
          stage('Interviewed', { chinese: 18, malay: 9, indian: 5, other: 4 }),
          stage('Hired', {}),
          stage('Rejected', {}),
        ],
      }),
    );
    expect(out.some((n) => n.id === 'phase-c-stage-dropoff')).toBe(false);
  });

  it('does not fire in promotion mode even with a textbook drop-off pattern', () => {
    const out = buildNudges(
      inputs({
        meetingType: 'promotion',
        pipeline: [
          stage('Applied', { chinese: 20, malay: 10, indian: 6, other: 4 }),
          stage('Interviewed', { chinese: 18, malay: 5, indian: 3, other: 2 }),
          stage('Hired', {}),
          stage('Rejected', {}),
        ],
      }),
    );
    expect(out.some((n) => n.id === 'phase-c-stage-dropoff')).toBe(false);
  });

  it('picks the transition with the widest gap when multiple qualify', () => {
    // Applied→Interviewed: rep drops 30%, maj drops 0% → gap 30pp.
    // Interviewed→Hired: rep drops 100%, maj drops 0% → gap 100pp.
    // The hired transition should win (and the sentence names it).
    const out = buildNudges(
      inputs({
        pipeline: [
          stage('Applied', { chinese: 20, malay: 10, indian: 6, other: 4 }),
          stage('Interviewed', { chinese: 20, malay: 7, indian: 4, other: 3 }),
          stage('Hired', { chinese: 20, malay: 0 }),
          stage('Rejected', {}),
        ],
      }),
    );
    const fired = out.find((n) => n.id === 'phase-c-stage-dropoff');
    expect(fired).toBeTruthy();
    expect(fired!.sentence).toContain('Interviewed and Hired');
  });
});

// ── Phase C: composition shift at hire ─────────────────────────────────
describe('Rule 7 — composition shift at hire (Phase C, hiring only)', () => {
  it('fires when hire-stage majority share is >15pp above applied', () => {
    // Applied: 50% majority (10/20). Hired: 80% majority (4/5). Shift = 30pp.
    const out = buildNudges(
      inputs({
        pipeline: [
          stage('Applied', { chinese: 10, malay: 6, indian: 4 }),
          stage('Interviewed', {}),
          stage('Hired', { chinese: 4, malay: 1 }),
          stage('Rejected', {}),
        ],
      }),
    );
    const fired = out.find((n) => n.id === 'phase-c-composition-shift');
    expect(fired).toBeTruthy();
    expect(fired!.sentence).toContain('80% majority background');
    expect(fired!.sentence).toContain('50%');
    expect(fired!.linkTo).toBe('Demographics');
  });

  it('excludes unknown demographics from both sides of the comparison', () => {
    // Applied: chinese 10, represented 6, unknown 100 — only the known
    // 16 form the denominator → applied majority share = ~63%.
    // Hired: chinese 5, represented 1 → 83%. Shift ≈ 20pp, fires.
    const out = buildNudges(
      inputs({
        pipeline: [
          stage('Applied', { chinese: 10, malay: 3, indian: 3, unknown: 100 }),
          stage('Interviewed', {}),
          stage('Hired', { chinese: 5, malay: 1, unknown: 50 }),
          stage('Rejected', {}),
        ],
      }),
    );
    expect(out.some((n) => n.id === 'phase-c-composition-shift')).toBe(true);
  });

  it('does not fire when the applied pool is below the floor', () => {
    // Only 5 known applied candidates — below the min-applied-total of 10.
    const out = buildNudges(
      inputs({
        pipeline: [
          stage('Applied', { chinese: 3, malay: 2 }),
          stage('Interviewed', {}),
          stage('Hired', { chinese: 3 }),
          stage('Rejected', {}),
        ],
      }),
    );
    expect(out.some((n) => n.id === 'phase-c-composition-shift')).toBe(false);
  });

  it('does not fire when the shift is below the threshold', () => {
    // Applied 60%, Hired 70%, shift = 10pp < threshold 15pp.
    const out = buildNudges(
      inputs({
        pipeline: [
          stage('Applied', { chinese: 12, malay: 5, indian: 3 }),
          stage('Interviewed', {}),
          stage('Hired', { chinese: 7, malay: 3 }),
          stage('Rejected', {}),
        ],
      }),
    );
    expect(out.some((n) => n.id === 'phase-c-composition-shift')).toBe(false);
  });

  it('does not fire in promotion mode', () => {
    const out = buildNudges(
      inputs({
        meetingType: 'promotion',
        pipeline: [
          stage('Applied', { chinese: 10, malay: 6, indian: 4 }),
          stage('Interviewed', {}),
          stage('Hired', { chinese: 4, malay: 1 }),
          stage('Rejected', {}),
        ],
      }),
    );
    expect(out.some((n) => n.id === 'phase-c-composition-shift')).toBe(false);
  });
});
