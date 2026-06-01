import { AsymmetricConcernRule } from '../AsymmetricConcernRule';

const rule = new AsymmetricConcernRule();

describe('AsymmetricConcernRule', () => {
  it('flags family-planning references', () => {
    const flags = rule.match('We discussed her plans for starting a family.');
    expect(flags).toHaveLength(1);
    expect(flags[0].flagType).toBe('asymmetric_concern');
    expect(flags[0].excerpt).toContain('plans for starting a family');
    expect(flags[0].suggestedAlt).toBeTruthy();
  });

  it('collapses "plans for starting a family" (0.95) and "starting a family" (0.92) to one flag', () => {
    const flags = rule.match('We discussed her plans for starting a family.');
    expect(flags).toHaveLength(1);
    expect(flags[0].confidenceScore).toBeCloseTo(0.95);
  });

  it('flags childcare-arrangement language', () => {
    const flags = rule.match('Wondered how her childcare arrangements would handle on-call weeks.');
    expect(flags).toHaveLength(1);
    expect(flags[0].excerpt).toContain('childcare arrangements');
  });

  it('flags "personal commitments at this life stage" as coded language', () => {
    const flags = rule.match(
      'There are personal commitments at this life stage that may make travel difficult.',
    );
    expect(flags[0].confidenceScore).toBeCloseTo(0.9);
  });

  it('catches separate asymmetric-concern phrases in different sentences', () => {
    const flags = rule.match(
      'We talked about her family responsibilities. Childcare arrangements were also raised.',
    );
    expect(flags).toHaveLength(2);
  });

  it('matches case-insensitively', () => {
    expect(rule.match('CHILDCARE ARRANGEMENTS were the issue.')).toHaveLength(1);
  });

  it('returns no flags when the interview discusses neutral availability', () => {
    expect(
      rule.match(
        'She confirmed she can travel for two-week stretches and is available for weekend on-call.',
      ),
    ).toEqual([]);
  });
});
