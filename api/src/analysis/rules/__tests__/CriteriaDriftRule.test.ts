import { CriteriaDriftRule } from '../CriteriaDriftRule';

const rule = new CriteriaDriftRule();

describe('CriteriaDriftRule', () => {
  it('flags "accent and phrasing" as a barrier to progression', () => {
    const flags = rule.match('Accent and phrasing may also be a concern for client work.');
    expect(flags).toHaveLength(1);
    expect(flags[0].flagType).toBe('criteria_drift');
    expect(flags[0].excerpt).toContain('Accent and phrasing');
    expect(flags[0].confidenceScore).toBeCloseTo(0.85);
    expect(flags[0].suggestedAlt).toBeTruthy();
  });

  it('flags "language barrier" framing', () => {
    const flags = rule.match('There was a noticeable language barrier during the case study.');
    expect(flags).toHaveLength(1);
    expect(flags[0].excerpt).toContain('language barrier');
  });

  it('flags "communication gap" as a selectively applied standard', () => {
    const flags = rule.match('The communication gap would be a liability with senior clients.');
    expect(flags[0].confidenceScore).toBeCloseTo(0.8);
  });

  it('flags conditional English-improvement language for any pronoun', () => {
    expect(rule.match('Recommend she improve her English before reapplying.')).toHaveLength(1);
    expect(rule.match('Recommend he improve his English first.')).toHaveLength(1);
    expect(rule.match('Recommend they improve their English in the meantime.')).toHaveLength(1);
  });

  it('catches separate criteria-drift phrases in different sentences', () => {
    const flags = rule.match(
      'Accent and phrasing was hard to follow. There was also a clear language barrier.',
    );
    expect(flags).toHaveLength(2);
  });

  it('matches case-insensitively', () => {
    expect(rule.match('ACCENT AND PHRASING was difficult.')).toHaveLength(1);
  });

  it('returns no flags for a clean transcript', () => {
    expect(
      rule.match('Communicated complex ideas clearly. Structured the case answer well.'),
    ).toEqual([]);
  });
});
