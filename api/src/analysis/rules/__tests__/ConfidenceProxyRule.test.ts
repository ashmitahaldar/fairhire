import { ConfidenceProxyRule } from '../ConfidenceProxyRule';

const rule = new ConfidenceProxyRule();

describe('ConfidenceProxyRule', () => {
  it('flags "needs more presence"', () => {
    const flags = rule.match('She needs more presence in client meetings.');
    expect(flags).toHaveLength(1);
    expect(flags[0].flagType).toBe('confidence_proxy');
    expect(flags[0].excerpt).toContain('needs more presence');
    expect(flags[0].confidenceScore).toBeCloseTo(0.9);
  });

  it('flags "needs more executive presence"', () => {
    const flags = rule.match('Needs more executive presence with senior clients.');
    expect(flags).toHaveLength(1);
  });

  it('flags "more assertive in the room"', () => {
    const flags = rule.match('Would like to see her more assertive in the room.');
    expect(flags).toHaveLength(1);
  });

  it('flags "should speak up more"', () => {
    const flags = rule.match('She should speak up more during the partner sessions.');
    expect(flags).toHaveLength(1);
  });

  it('flags "not assertive enough"', () => {
    const flags = rule.match('Honestly not assertive enough in negotiations.');
    expect(flags).toHaveLength(1);
  });

  it('flags "lacks confidence"', () => {
    const flags = rule.match('Lacks confidence when pushing back on the lead partner.');
    expect(flags).toHaveLength(1);
  });

  it('matches case-insensitively', () => {
    expect(rule.match('NEEDS MORE GRAVITAS.')).toHaveLength(1);
  });

  it('returns no flags for behaviourally anchored feedback', () => {
    expect(
      rule.match(
        'In the credit committee, summarised the risk position in two sentences. Strong execution.',
      ),
    ).toEqual([]);
  });
});
