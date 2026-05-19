import { deduplicate } from '../analysis/HybridRouter';
import type { FlagCandidate } from '../analysis/types';

const ruleFlag = (over: Partial<FlagCandidate> = {}): FlagCandidate => ({
  flagType: 'hedging_language',
  excerpt: 'Not sure about the cultural fit with our team.',
  reasoning: 'rule',
  confidenceScore: 0.8,
  ...over,
});

describe('deduplicate (HybridRouter)', () => {
  it('keeps both when excerpts do not overlap', () => {
    const rules = [ruleFlag()];
    const llm = [ruleFlag({ excerpt: 'A totally different concern entirely here.', reasoning: 'llm' })];
    expect(deduplicate(rules, llm)).toHaveLength(2);
  });

  it('LLM flag replaces an overlapping rule flag when its confidence is higher', () => {
    const rules = [ruleFlag({ confidenceScore: 0.7 })];
    const llm = [ruleFlag({ confidenceScore: 0.95, reasoning: 'llm' })];
    const merged = deduplicate(rules, llm);
    expect(merged).toHaveLength(1);
    expect(merged[0].reasoning).toBe('llm');
  });

  it('keeps the rule flag when it has higher confidence than an overlapping LLM flag', () => {
    const rules = [ruleFlag({ confidenceScore: 0.9 })];
    const llm = [ruleFlag({ confidenceScore: 0.6, reasoning: 'llm' })];
    const merged = deduplicate(rules, llm);
    expect(merged).toHaveLength(1);
    expect(merged[0].reasoning).toBe('rule');
  });

  it('does NOT merge a short LLM excerpt sitting inside a long rule sentence (ratio guard)', () => {
    const rules = [
      ruleFlag({
        excerpt:
          'During the panel we covered many topics but I am not sure about the cultural fit overall here.',
      }),
    ];
    const llm = [ruleFlag({ excerpt: 'cultural fit', reasoning: 'llm' })];
    // "cultural fit" is contained but only ~12 chars vs ~95 → below ratio → distinct
    expect(deduplicate(rules, llm)).toHaveLength(2);
  });

  it('does not merge overlapping excerpts of different flag types', () => {
    const rules = [ruleFlag({ flagType: 'hedging_language' })];
    const llm = [ruleFlag({ flagType: 'age_bias', reasoning: 'llm' })];
    expect(deduplicate(rules, llm)).toHaveLength(2);
  });
});
