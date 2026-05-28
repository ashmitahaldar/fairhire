import {
  OVERLAP_THRESHOLD,
  computePRF,
  fairnessByDimension,
  matchFlags,
  spanOverlap,
  type ScorableFlag,
} from '../analysis/eval/metrics';

describe('spanOverlap', () => {
  it('is 1 for identical excerpts', () => {
    expect(spanOverlap('the late nights', 'the late nights')).toBe(1);
  });

  it('is 1 when one excerpt contains the other', () => {
    expect(spanOverlap('struggle with the late nights given family', 'the late nights')).toBe(1);
  });

  it('ignores case and collapses whitespace', () => {
    expect(spanOverlap('The  Late   Nights', 'the late nights')).toBeCloseTo(1);
  });

  it('is below threshold for unrelated excerpts', () => {
    expect(spanOverlap('strong technical background', 'culture fit concerns')).toBeLessThan(
      OVERLAP_THRESHOLD,
    );
  });
});

describe('matchFlags', () => {
  const gt: ScorableFlag[] = [
    { flagType: 'biased_language', excerpt: 'she might struggle with the late nights given her family' },
    { flagType: 'criteria_drift', excerpt: 'communication style felt indirect and hard to follow' },
  ];

  it('counts a same-type overlapping prediction as a TP', () => {
    const pred: ScorableFlag[] = [
      { flagType: 'biased_language', excerpt: 'struggle with the late nights given her family' },
    ];
    expect(matchFlags(pred, gt)).toEqual({ tp: 1, fp: 0, fn: 1 });
  });

  it('does not match across different flag types', () => {
    const pred: ScorableFlag[] = [
      { flagType: 'age_bias', excerpt: 'she might struggle with the late nights given her family' },
    ];
    expect(matchFlags(pred, gt)).toEqual({ tp: 0, fp: 1, fn: 2 });
  });

  it('counts unmatched predictions as FP and unmatched ground truth as FN', () => {
    const pred: ScorableFlag[] = [
      { flagType: 'hedging_language', excerpt: 'an entirely unrelated phrase' },
    ];
    expect(matchFlags(pred, gt)).toEqual({ tp: 0, fp: 1, fn: 2 });
  });

  it('matches each ground-truth flag at most once (greedy 1:1)', () => {
    const dup = 'struggle with the late nights given her family';
    const pred: ScorableFlag[] = [
      { flagType: 'biased_language', excerpt: dup },
      { flagType: 'biased_language', excerpt: dup },
    ];
    expect(matchFlags(pred, gt)).toEqual({ tp: 1, fp: 1, fn: 1 });
  });
});

describe('computePRF', () => {
  it('computes precision, recall and F1', () => {
    const prf = computePRF({ tp: 3, fp: 1, fn: 1 });
    expect(prf.precision).toBeCloseTo(0.75);
    expect(prf.recall).toBeCloseTo(0.75);
    expect(prf.f1).toBeCloseTo(0.75);
  });

  it('returns null precision when there are no predictions', () => {
    expect(computePRF({ tp: 0, fp: 0, fn: 2 }).precision).toBeNull();
  });

  it('returns null recall when there is no ground truth', () => {
    expect(computePRF({ tp: 0, fp: 1, fn: 0 }).recall).toBeNull();
  });
});

describe('fairnessByDimension', () => {
  it('groups candidates by a demographic value with n and flag totals', () => {
    const stats = fairnessByDimension(
      [
        { demographics: { race: 'malay' }, flagCount: 2 },
        { demographics: { race: 'malay' }, flagCount: 0 },
        { demographics: { race: 'chinese' }, flagCount: 1 },
      ],
      'race',
    );
    expect(stats.find((s) => s.value === 'malay')).toEqual({
      value: 'malay',
      n: 2,
      flaggedCandidates: 1,
      totalFlags: 2,
    });
    expect(stats.find((s) => s.value === 'chinese')?.n).toBe(1);
  });

  it('buckets a missing value as "unknown"', () => {
    const stats = fairnessByDimension([{ demographics: {}, flagCount: 0 }], 'gender');
    expect(stats[0].value).toBe('unknown');
  });
});
