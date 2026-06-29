import {
  type FlagType,
  type HrDemographicRow,
  type HrDemographicsResponse,
  type HrFlagTypeCount,
  type HrFlagsResponse,
} from '@fairhire/shared';
import { buildHrNudges, type HrNudgeInputs } from '../nudges';

// Synthetic-input unit tests for each HR nudge rule + the orchestrator. Pure
// functions over the /hr aggregate shapes — no Prisma, no DB.

function ft(
  type: FlagType,
  count: number,
  dismissed = 0,
  delta: number | null = null,
): HrFlagTypeCount {
  return { type, count, dismissed, delta };
}

function flagsResp(byType: HrFlagTypeCount[]): HrFlagsResponse {
  return {
    period: '90d',
    total: byType.reduce((s, r) => s + r.count, 0),
    dismissed: byType.reduce((s, r) => s + r.dismissed, 0),
    byType,
  };
}

function demoResp(byRace: HrDemographicRow[]): HrDemographicsResponse {
  return { period: '90d', byRace };
}

function race(
  r: HrDemographicRow['race'],
  applied: number,
  hired = 0,
  rejected = 0,
): HrDemographicRow {
  return { race: r, applied, hired, rejected };
}

function inputs(over: Partial<HrNudgeInputs> = {}): HrNudgeInputs {
  return {
    flags: flagsResp([]),
    demographics: demoResp([]),
    ...over,
  };
}

// Convenience: run all rules and index the surfaced nudges by id.
function nudgeIds(input: HrNudgeInputs): string[] {
  return buildHrNudges(input).map((n) => n.id);
}

describe('orgDominantCategory', () => {
  it('fires when the top category clears the floor and is ≥2× the next', () => {
    const input = inputs({
      flags: flagsResp([ft('criteria_drift', 12), ft('age_bias', 4)]),
    });
    const nudges = buildHrNudges(input);
    const n = nudges.find((x) => x.id === 'hr-top-category-dominance');
    expect(n).toBeDefined();
    expect(n!.linkTo).toBe('Flags');
    expect(n!.sentence).toContain('3×'); // 12 / 4 rounded
  });

  it('does not fire below the absolute count floor (8)', () => {
    const input = inputs({ flags: flagsResp([ft('criteria_drift', 6), ft('age_bias', 2)]) });
    expect(nudgeIds(input)).not.toContain('hr-top-category-dominance');
  });

  it('does not fire when the lead is under 2×', () => {
    const input = inputs({ flags: flagsResp([ft('criteria_drift', 10), ft('age_bias', 6)]) });
    expect(nudgeIds(input)).not.toContain('hr-top-category-dominance');
  });
});

describe('orgCategorySurge', () => {
  it('fires when a type clears the floor and rose ≥50% over prior', () => {
    // count 12, delta 6 → prior 6, relative +100%
    const input = inputs({ flags: flagsResp([ft('hedging_language', 12, 0, 6)]) });
    const n = buildHrNudges(input).find((x) => x.id === 'hr-category-surge');
    expect(n).toBeDefined();
    expect(n!.sentence).toContain('up 6');
  });

  it('does not fire on a sparse (null delta) row', () => {
    const input = inputs({ flags: flagsResp([ft('hedging_language', 12, 0, null)]) });
    expect(nudgeIds(input)).not.toContain('hr-category-surge');
  });

  it('does not fire below the current-count floor (8)', () => {
    const input = inputs({ flags: flagsResp([ft('hedging_language', 6, 0, 4)]) });
    expect(nudgeIds(input)).not.toContain('hr-category-surge');
  });
});

describe('dismissalRateByType', () => {
  it('fires when a type is dismissed ≥60% of the time over its floor', () => {
    const input = inputs({ flags: flagsResp([ft('age_bias', 10, 8)]) });
    const n = buildHrNudges(input).find((x) => x.id === 'hr-dismissal-rate-by-type');
    expect(n).toBeDefined();
    expect(n!.sentence).toContain('80%');
    expect(n!.sentence).toContain('8 of 10');
  });

  it('does not fire below the per-type count floor (6)', () => {
    const input = inputs({ flags: flagsResp([ft('age_bias', 5, 5)]) });
    expect(nudgeIds(input)).not.toContain('hr-dismissal-rate-by-type');
  });

  it('does not fire below the dismissal-rate threshold', () => {
    const input = inputs({ flags: flagsResp([ft('age_bias', 10, 4)]) }); // 40%
    expect(nudgeIds(input)).not.toContain('hr-dismissal-rate-by-type');
  });
});

describe('compositionShiftAtHire', () => {
  it('fires when the majority share at hire exceeds the applied share by ≥15pp', () => {
    const input = inputs({
      demographics: demoResp([
        race('chinese', 7, 9),
        race('malay', 2, 1),
        race('indian', 1, 0),
      ]),
    });
    // applied known 10, majority 7 → 70%; hired known 10, majority 9 → 90%; +20pp
    const n = buildHrNudges(input).find((x) => x.id === 'hr-composition-shift');
    expect(n).toBeDefined();
    expect(n!.linkTo).toBe('Demographics');
    expect(n!.sentence).toContain('90% majority');
    expect(n!.sentence).toContain('70%');
  });

  it('excludes unknown from the denominator', () => {
    // Without excluding unknown, applied majority share would be 7/17 ≈ 41%.
    // Excluding it: 7/10 = 70%, matching the firing case above.
    const input = inputs({
      demographics: demoResp([
        race('chinese', 7, 9),
        race('malay', 2, 1),
        race('indian', 1, 0),
        race('unknown', 7, 5),
      ]),
    });
    const n = buildHrNudges(input).find((x) => x.id === 'hr-composition-shift');
    expect(n).toBeDefined();
    expect(n!.sentence).toContain('70%');
  });

  it('does not fire below the minimum known applied pool (10)', () => {
    const input = inputs({
      demographics: demoResp([race('chinese', 5, 5), race('malay', 2, 0)]), // known 7
    });
    expect(nudgeIds(input)).not.toContain('hr-composition-shift');
  });

  it('does not fire below the 15pp shift threshold', () => {
    const input = inputs({
      demographics: demoResp([race('chinese', 7, 7), race('malay', 3, 3)]),
    });
    // applied 70%, hired 70% → 0pp
    expect(nudgeIds(input)).not.toContain('hr-composition-shift');
  });
});

describe('buildHrNudges orchestrator', () => {
  it('sorts by severity desc and caps at 3 (drops the lowest)', () => {
    // criteria_drift: count 12, dismissed 9, delta 6 → fires dominance (3×),
    // surge (+100%), and dismissal (75%). age_bias is the quiet runner-up.
    const flags = flagsResp([ft('criteria_drift', 12, 9, 6), ft('age_bias', 4, 0, 0)]);
    const demographics = demoResp([race('chinese', 7, 9), race('malay', 3, 1)]); // +20pp shift
    const nudges = buildHrNudges({ flags, demographics });

    expect(nudges).toHaveLength(3);
    // Composition shift (severity 20) outranks dominance (3); dismissal rate
    // (0.75) is the lowest and gets dropped.
    expect(nudges[0]!.id).toBe('hr-composition-shift');
    const ids = nudges.map((n) => n.id);
    expect(ids).toContain('hr-top-category-dominance');
    expect(ids).toContain('hr-category-surge');
    expect(ids).not.toContain('hr-dismissal-rate-by-type');
  });

  it('returns an empty array when nothing fires', () => {
    expect(buildHrNudges(inputs())).toEqual([]);
  });
});
