import { describe, it, expect } from 'vitest';
import type { PipelineRow } from '../../../lib/mirrorData';
import { computeConversionRows } from '../ConversionGrid';

describe('computeConversionRows', () => {
  it('returns one row per consecutive stage transition', () => {
    const pipeline: PipelineRow[] = [
      { stage: 'A', represented: 100, majority: 100, total: 200 },
      { stage: 'B', represented:  50, majority:  70, total: 120 },
      { stage: 'C', represented:  10, majority:  35, total:  45 },
    ];
    const rows = computeConversionRows(pipeline);
    expect(rows.map((r) => r.label)).toEqual(['A → B', 'B → C']);
  });

  it('computes conversion percentages per group and a signed gap', () => {
    const pipeline: PipelineRow[] = [
      { stage: 'Applied',    represented: 200, majority: 400, total: 600 },
      { stage: 'Interviewed', represented:  50, majority: 200, total: 250 },
    ];
    const [row] = computeConversionRows(pipeline);
    expect(row.repPct).toBeCloseTo(25);
    expect(row.majPct).toBeCloseTo(50);
    // Majority advances at a higher rate — positive gap.
    expect(row.gap).toBeCloseTo(25);
  });

  it('returns no rows when only one stage is provided', () => {
    expect(computeConversionRows([
      { stage: 'Applied', represented: 100, majority: 100, total: 200 },
    ])).toEqual([]);
  });
});
