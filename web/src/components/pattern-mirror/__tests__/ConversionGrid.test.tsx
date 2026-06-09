import { describe, it, expect } from 'vitest';
import type { PipelineRow } from '../../../lib/mirrorData';
import { computeConversionRows } from '../ConversionGrid';

// Step 6: PipelineRow now carries a per-race `segments` map instead of
// a represented/majority binary. The grid derives the binary internally
// via the Section-3 convention (Chinese = majority, non-Chinese-non-
// unknown = represented). Each fixture below stages the equivalent of
// the old {represented, majority} pair: chinese counts the majority,
// malay counts the represented, the other races stay at 0.

function row(stage: string, represented: number, majority: number, total = represented + majority): PipelineRow {
  return {
    stage,
    segments: { chinese: majority, malay: represented, indian: 0, other: 0, unknown: 0 },
    total,
  };
}

describe('computeConversionRows', () => {
  it('returns one row per consecutive stage transition', () => {
    const pipeline: PipelineRow[] = [
      row('A', 100, 100, 200),
      row('B',  50,  70, 120),
      row('C',  10,  35,  45),
    ];
    const rows = computeConversionRows(pipeline);
    expect(rows.map((r) => r.label)).toEqual(['A → B', 'B → C']);
  });

  it('computes conversion percentages per group and a signed gap', () => {
    const pipeline: PipelineRow[] = [
      row('Applied',     200, 400, 600),
      row('Interviewed',  50, 200, 250),
    ];
    const [conv] = computeConversionRows(pipeline);
    expect(conv!.repPct).toBeCloseTo(25);
    expect(conv!.majPct).toBeCloseTo(50);
    // Majority advances at a higher rate — positive gap.
    expect(conv!.gap).toBeCloseTo(25);
  });

  it('returns no rows when only one stage is provided', () => {
    expect(computeConversionRows([row('Applied', 100, 100, 200)])).toEqual([]);
  });

  it('treats a zero-prev-stage count as a zero conversion rate (no NaN/Infinity)', () => {
    const pipeline: PipelineRow[] = [
      row('Applied',     0, 100, 100),
      row('Interviewed', 0,  60,  60),
    ];
    const [conv] = computeConversionRows(pipeline);
    expect(conv!.repPct).toBe(0);
    expect(Number.isFinite(conv!.repPct)).toBe(true);
    expect(conv!.majPct).toBeCloseTo(60);
    expect(conv!.gap).toBeCloseTo(60);
  });

  it('aggregates malay + indian + other into the represented bucket', () => {
    // Each non-Chinese race contributes to "represented". Unknown does not.
    const pipeline: PipelineRow[] = [
      {
        stage: 'Applied',
        segments: { chinese: 400, malay: 80, indian: 70, other: 50, unknown: 25 },
        total: 625,
      },
      {
        stage: 'Interviewed',
        segments: { chinese: 200, malay: 40, indian: 35, other: 25, unknown: 0 },
        total: 300,
      },
    ];
    const [conv] = computeConversionRows(pipeline);
    // represented = 80+70+50 = 200 → 40+35+25 = 100 → 50%
    expect(conv!.repPct).toBeCloseTo(50);
    // majority (Chinese) 400 → 200 → 50%
    expect(conv!.majPct).toBeCloseTo(50);
    // Unknown candidates (25 → 0) don't influence the gap.
    expect(conv!.gap).toBeCloseTo(0);
  });
});
