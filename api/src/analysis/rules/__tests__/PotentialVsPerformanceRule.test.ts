import { PotentialVsPerformanceRule } from '../PotentialVsPerformanceRule';

const rule = new PotentialVsPerformanceRule();

describe('PotentialVsPerformanceRule', () => {
  it('flags "a lot of potential" framing', () => {
    const flags = rule.match('She has a lot of potential for the next level.');
    expect(flags).toHaveLength(1);
    expect(flags[0].flagType).toBe('potential_vs_performance');
    expect(flags[0].excerpt).toContain('lot of potential');
    expect(flags[0].confidenceScore).toBeCloseTo(0.88);
    expect(flags[0].suggestedAlt).toBeTruthy();
  });

  it('flags "could grow into the role" framing', () => {
    const flags = rule.match('He could grow into the role over the next year.');
    expect(flags).toHaveLength(1);
    expect(flags[0].confidenceScore).toBeCloseTo(0.85);
  });

  it('flags "high ceiling" as projected-upside language', () => {
    const flags = rule.match('High ceiling here, worth promoting now.');
    expect(flags).toHaveLength(1);
    expect(flags[0].excerpt).toContain('High ceiling');
  });

  it('flags both gendered "showing potential" variants', () => {
    expect(rule.match('She is showing strong potential this cycle.')).toHaveLength(1);
    expect(rule.match('He shows real potential.')).toHaveLength(1);
  });

  it('matches case-insensitively', () => {
    expect(rule.match('LOTS OF POTENTIAL noted.')).toHaveLength(1);
  });

  it('returns no flags for a clean promotion case', () => {
    expect(
      rule.match(
        'Delivered three target-level transactions this cycle. Owned the client relationship throughout.',
      ),
    ).toEqual([]);
  });
});
