import type { FlagType } from '@fairhire/shared';
import { Rule, extractExcerpt, type PhraseEntry } from '../Rule';

// Exercises the Rule base class via a minimal concrete subclass — covers the
// regex-handling, excerpt-extraction, and per-rule dedup that every real rule
// inherits. Concrete-rule files only test their own phrase lists.

class TestRule extends Rule {
  readonly id = 'test-rule';
  readonly flagType: FlagType = 'hedging_language';
  protected phrases: PhraseEntry[];
  constructor(phrases: PhraseEntry[]) {
    super();
    this.phrases = phrases;
  }
}

describe('extractExcerpt', () => {
  it('returns the sentence around the match', () => {
    const t = 'Some preamble. The candidate showed good energy. Final notes follow.';
    const idx = t.indexOf('good energy');
    expect(extractExcerpt(t, idx, 'good energy'.length)).toBe('The candidate showed good energy.');
  });

  it('handles a match at the start of the transcript', () => {
    const t = 'Cultural fit was the concern. Other notes.';
    expect(extractExcerpt(t, 0, 'Cultural fit'.length)).toBe('Cultural fit was the concern.');
  });

  it('handles a match in the trailing sentence with no closing period', () => {
    const t = 'Earlier text. Final thought cultural fit';
    const idx = t.indexOf('cultural fit');
    expect(extractExcerpt(t, idx, 'cultural fit'.length)).toBe('Final thought cultural fit');
  });
});

describe('Rule.match', () => {
  it('matches case-insensitively by default for string patterns', () => {
    const rule = new TestRule([
      { pattern: 'cultural fit', confidence: 0.8, reasoning: 'r', suggestedAlt: 's' },
    ]);
    expect(rule.match('CULTURAL FIT was raised.')).toHaveLength(1);
  });

  it('preserves regex flags and forces global iteration', () => {
    // No 'i' flag — must NOT match the upper-cased instance, only the lower one.
    const rule = new TestRule([
      { pattern: /cultural fit/, confidence: 0.8, reasoning: 'r' },
    ]);
    const flags = rule.match('CULTURAL FIT first. Then cultural fit again.');
    expect(flags).toHaveLength(1);
    expect(flags[0].excerpt).toContain('cultural fit again');
  });

  it('extracts the full surrounding sentence as the excerpt, not just the phrase', () => {
    const rule = new TestRule([
      { pattern: 'cultural fit', confidence: 0.8, reasoning: 'r' },
    ]);
    const flags = rule.match('We thought hard about cultural fit before deciding. Other notes.');
    expect(flags[0].excerpt).toBe('We thought hard about cultural fit before deciding.');
  });

  it('returns each metadata field from the matched PhraseEntry', () => {
    const rule = new TestRule([
      { pattern: 'cultural fit', confidence: 0.77, reasoning: 'because', suggestedAlt: 'try this' },
    ]);
    const f = rule.match('cultural fit')[0];
    expect(f.confidenceScore).toBe(0.77);
    expect(f.reasoning).toBe('because');
    expect(f.suggestedAlt).toBe('try this');
    expect(f.flagType).toBe('hedging_language');
  });

  it('collapses overlapping phrases on one sentence to the highest-confidence entry', () => {
    const rule = new TestRule([
      { pattern: 'cultural fit', confidence: 0.7, reasoning: 'low' },
      { pattern: 'team and cultural fit', confidence: 0.9, reasoning: 'high' },
    ]);
    const flags = rule.match('Team and cultural fit was the rationale.');
    expect(flags).toHaveLength(1);
    expect(flags[0].confidenceScore).toBe(0.9);
    expect(flags[0].reasoning).toBe('high');
  });

  it('returns separate flags for the same pattern in different sentences', () => {
    const rule = new TestRule([
      { pattern: 'cultural fit', confidence: 0.8, reasoning: 'r' },
    ]);
    const flags = rule.match('Cultural fit in round one. Later, cultural fit again in round two.');
    expect(flags).toHaveLength(2);
  });

  it('returns an empty array when no pattern matches', () => {
    const rule = new TestRule([
      { pattern: 'cultural fit', confidence: 0.8, reasoning: 'r' },
    ]);
    expect(rule.match('Strong technical answers throughout the interview.')).toEqual([]);
  });
});
