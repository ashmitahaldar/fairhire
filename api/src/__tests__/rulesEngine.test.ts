import { RulesEngine } from '../analysis/RulesEngine';

// Pure unit tests — the rules engine has no I/O, so no mocks are needed.
const engine = new RulesEngine();

describe('RulesEngine', () => {
  it('flags asymmetric_concern on family-planning language', () => {
    const flags = engine.run('We discussed her plans for starting a family.');
    const f = flags.find((x) => x.flagType === 'asymmetric_concern');
    expect(f).toBeDefined();
    expect(f!.excerpt).toContain('starting a family');
    expect(f!.confidenceScore).toBeGreaterThan(0.8);
    expect(f!.reasoning).toBeTruthy();
    expect(f!.suggestedAlt).toBeTruthy();
  });

  it('flags hedging_language on undefined "cultural fit"', () => {
    const flags = engine.run('Not sure about the cultural fit with our team.');
    expect(flags.some((x) => x.flagType === 'hedging_language')).toBe(true);
  });

  it('flags age_bias on energy/pace language', () => {
    const flags = engine.run('Worried about his energy needed for the pace of our deals.');
    expect(flags.some((x) => x.flagType === 'age_bias')).toBe(true);
  });

  it('flags criteria_drift on accent/language-standard language', () => {
    const flags = engine.run('Accent and phrasing may also be a concern for client work.');
    expect(flags.some((x) => x.flagType === 'criteria_drift')).toBe(true);
  });

  it('returns no flags for a clean transcript', () => {
    const flags = engine.run(
      'Strong technical answers. Clear, well-structured case study. Recommend progressing.',
    );
    expect(flags).toEqual([]);
  });

  it('detects all four patterns in one transcript', () => {
    const flags = engine.run(
      'We discussed her plans for starting a family. Not sure about the cultural fit. ' +
        'Worried about his energy needed for the pace. Accent and phrasing may be a concern.',
    );
    const types = new Set(flags.map((f) => f.flagType));
    expect(types).toEqual(
      new Set(['asymmetric_concern', 'hedging_language', 'age_bias', 'criteria_drift']),
    );
  });

  it('collapses overlapping phrases on one sentence to the highest-confidence flag', () => {
    // "plans for starting a family" (0.95) contains "starting a family" (0.92)
    const flags = engine.run('We discussed her plans for starting a family.');
    const asym = flags.filter((f) => f.flagType === 'asymmetric_concern');
    expect(asym).toHaveLength(1);
    expect(asym[0].confidenceScore).toBe(0.95);
  });

  it('terminates on repeated matches (regression: non-global regex infinite loop)', () => {
    // Before the fix this looped forever on the first match. Completing at all
    // is the assertion; dedup by excerpt keeps the result to one flag.
    const flags = engine.run('cultural fit. cultural fit. cultural fit.');
    expect(flags.length).toBeGreaterThanOrEqual(1);
    expect(flags.every((f) => f.flagType === 'hedging_language')).toBe(true);
  });

  // ── Week 5: mode-aware rule selection ──────────────────────────────────
  // Hiring rules don't fire in promotion mode and vice-versa. Individual
  // rule suites cover phrase-level matching; this is the integration check.

  it('does not fire hiring rules when run in promotion mode', () => {
    const flags = engine.run(
      'We discussed her plans for starting a family. Not sure about cultural fit.',
      'promotion',
    );
    expect(flags.some((f) => f.flagType === 'asymmetric_concern')).toBe(false);
    expect(flags.some((f) => f.flagType === 'hedging_language')).toBe(false);
  });

  it('fires promotion rules in promotion mode', () => {
    const flags = engine.run(
      'She has a lot of potential. He earned his stripes over the past five cycles.',
      'promotion',
    );
    const types = new Set(flags.map((f) => f.flagType));
    expect(types.has('potential_vs_performance')).toBe(true);
    expect(types.has('tenure_framing')).toBe(true);
  });

  it('does not fire promotion rules in hiring mode (default)', () => {
    const flags = engine.run('She has a lot of potential for the role.');
    expect(flags.some((f) => f.flagType === 'potential_vs_performance')).toBe(false);
  });
});
