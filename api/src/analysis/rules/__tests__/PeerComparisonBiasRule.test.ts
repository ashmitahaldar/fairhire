import { PeerComparisonBiasRule } from '../PeerComparisonBiasRule';

const rule = new PeerComparisonBiasRule();

describe('PeerComparisonBiasRule', () => {
  it('flags "not as strong as [Name]"', () => {
    const flags = rule.match('Frankly, not as strong as Marcus on M&A pitches.');
    expect(flags).toHaveLength(1);
    expect(flags[0].flagType).toBe('peer_comparison_bias');
    expect(flags[0].excerpt).toContain('not as strong as Marcus');
    expect(flags[0].confidenceScore).toBeCloseTo(0.88);
  });

  it('flags "compared to [Name]"', () => {
    const flags = rule.match('Compared to Priya, the writing is less polished.');
    expect(flags).toHaveLength(1);
    expect(flags[0].confidenceScore).toBeCloseTo(0.78);
  });

  it('flags "the way [Name] does"', () => {
    const flags = rule.match('Not in the way Wei handles client escalations.');
    expect(flags).toHaveLength(1);
  });

  it('flags "[Name] at this stage would"', () => {
    const flags = rule.match('Linh at this stage would have closed two more deals.');
    expect(flags).toHaveLength(1);
  });

  it('does not fire on lowercase pronouns', () => {
    // "compared to him" should NOT trigger — only named comparators.
    expect(rule.match('Compared to him, the writing is less polished.')).toHaveLength(0);
  });

  it('returns no flags when comparison is rubric-anchored', () => {
    expect(
      rule.match('Meets the rubric on origination but not yet on execution scope.'),
    ).toEqual([]);
  });
});
