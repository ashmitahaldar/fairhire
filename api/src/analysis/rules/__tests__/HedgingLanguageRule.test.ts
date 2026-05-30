import { HedgingLanguageRule } from '../HedgingLanguageRule';

const rule = new HedgingLanguageRule();

describe('HedgingLanguageRule', () => {
  it('flags an undefined "cultural fit" reference', () => {
    const flags = rule.match('Not sure about the cultural fit with our team.');
    expect(flags).toHaveLength(1);
    expect(flags[0].flagType).toBe('hedging_language');
    expect(flags[0].excerpt).toContain('cultural fit');
    expect(flags[0].confidenceScore).toBeGreaterThanOrEqual(0.85);
    expect(flags[0].suggestedAlt).toBeTruthy();
  });

  it('flags "hard to gel" interpersonal language', () => {
    const flags = rule.match("I felt he was hard to gel with the existing team.");
    expect(flags.some((f) => /hard to gel/i.test(f.excerpt))).toBe(true);
  });

  it('flags vague "working style" and "team dynamic" concerns', () => {
    const flags = rule.match(
      "His working style is a concern. We also worry about the team dynamic.",
    );
    expect(flags).toHaveLength(2);
    expect(new Set(flags.map((f) => f.flagType))).toEqual(new Set(['hedging_language']));
  });

  it('fires on "culture and team fit" used as a concern', () => {
    const flags = rule.match(
      'Technical bar is met but culture and team fit is a concern that I cannot look past.',
    );
    expect(flags).toHaveLength(1);
    expect(flags[0].excerpt).toContain('culture and team fit');
    expect(flags[0].confidenceScore).toBeCloseTo(0.9);
  });

  // Locks the calibration fix — the seed's positive note-header form
  // ("Culture and team fit: Positive") is a neutral assessment, not a vague
  // justification, and must not fire. See HedgingLanguageRule.ts.
  it('does NOT fire on positive note-header form "Culture and team fit: Positive"', () => {
    expect(rule.match('Culture and team fit: Positive — gels well with the team.')).toEqual([]);
    expect(rule.match('culture and team fit: strong throughout')).toEqual([]);
    expect(rule.match('culture and team fit good')).toEqual([]);
  });

  it('matches case-insensitively', () => {
    expect(rule.match('CULTURAL FIT is the issue.')).toHaveLength(1);
  });

  it('returns no flags for a clean transcript', () => {
    expect(
      rule.match('Strong technical answers. Clear case study walkthrough. Recommend progressing.'),
    ).toEqual([]);
  });
});
