import { AgeBiasRule } from '../AgeBiasRule';

const rule = new AgeBiasRule();

describe('AgeBiasRule', () => {
  it('flags "energy needed for the pace" language', () => {
    const flags = rule.match('Worried about his energy needed for the pace of our deals.');
    expect(flags).toHaveLength(1);
    expect(flags[0].flagType).toBe('age_bias');
    expect(flags[0].excerpt).toContain('energy needed for the pace');
    expect(flags[0].confidenceScore).toBeGreaterThanOrEqual(0.9);
    expect(flags[0].suggestedAlt).toBeTruthy();
  });

  it('flags "current stage of career" as coded age language', () => {
    const flags = rule.match("This role's intensity might not suit his current stage of career.");
    expect(flags.some((f) => /current stage of (his|her|their)? ?career/i.test(f.excerpt))).toBe(true);
  });

  it('flags "stamina and drive" without performance basis', () => {
    const flags = rule.match('We had questions about his stamina and drive for the role.');
    expect(flags).toHaveLength(1);
    expect(flags[0].confidenceScore).toBeCloseTo(0.88);
  });

  it('collapses overlapping career-stage patterns to the highest-confidence entry', () => {
    // "current stage of his career" (0.90) contains "stage of his career" (0.85).
    const flags = rule.match("He is at the current stage of his career where pace matters.");
    expect(flags).toHaveLength(1);
    expect(flags[0].confidenceScore).toBeCloseTo(0.9);
  });

  it('catches separate age-coded phrases in different sentences', () => {
    const flags = rule.match(
      'Energy needed for the pace was unclear. Methodologies appear dated based on the case discussion.',
    );
    expect(flags).toHaveLength(2);
  });

  it('matches case-insensitively', () => {
    expect(rule.match('ENERGY NEEDED FOR THE PACE was the concern.')).toHaveLength(1);
  });

  it('returns no flags for a clean transcript', () => {
    expect(
      rule.match('Strong analytical reasoning throughout. Clear, structured case answers.'),
    ).toEqual([]);
  });
});
