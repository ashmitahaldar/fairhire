import { TenureFramingRule } from '../TenureFramingRule';

const rule = new TenureFramingRule();

describe('TenureFramingRule', () => {
  it('flags "been here a long time" as a tenure rationale', () => {
    const flags = rule.match("He's been here a long time and deserves the move.");
    expect(flags).toHaveLength(1);
    expect(flags[0].flagType).toBe('tenure_framing');
    expect(flags[0].excerpt).toMatch(/been here a long time/i);
    expect(flags[0].confidenceScore).toBeCloseTo(0.85);
  });

  it('flags "earned his stripes"', () => {
    const flags = rule.match('He has earned his stripes over the past five cycles.');
    expect(flags).toHaveLength(1);
    expect(flags[0].confidenceScore).toBeCloseTo(0.88);
  });

  it('flags "waited his turn"', () => {
    const flags = rule.match('She has waited her turn longer than most.');
    expect(flags).toHaveLength(1);
  });

  it('flags loyalty framing', () => {
    const flags = rule.match('Loyalty to the team should count for something here.');
    expect(flags).toHaveLength(1);
  });

  it('flags "put in his time"', () => {
    const flags = rule.match('She has put in her time on the desk.');
    expect(flags).toHaveLength(1);
  });

  it('flags "it\'s his time"', () => {
    const flags = rule.match("Honestly it's his time — should go up this cycle.");
    expect(flags).toHaveLength(1);
  });

  it('matches case-insensitively', () => {
    expect(rule.match('EARNED HIS STRIPES over many cycles.')).toHaveLength(1);
  });

  it('returns no flags for a rubric-anchored case', () => {
    expect(
      rule.match(
        'Two target-level mandates this cycle. Owned investor relations end-to-end.',
      ),
    ).toEqual([]);
  });
});
