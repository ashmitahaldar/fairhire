import { enforceConfidenceFloor } from '../analysis/llm/LLMAnalyser';
import type { FlagCandidate } from '../analysis/types';

const f = (confidenceScore: number): FlagCandidate => ({
  flagType: 'hedging_language',
  excerpt: 'x',
  reasoning: 'y',
  confidenceScore,
});

describe('enforceConfidenceFloor — LLM prompt contract (>= 0.5)', () => {
  it('drops flags strictly below 0.5', () => {
    expect(enforceConfidenceFloor([f(0.49), f(0.3), f(0)])).toEqual([]);
  });

  it('keeps flags at exactly 0.5 (boundary is inclusive)', () => {
    const flags = enforceConfidenceFloor([f(0.5)]);
    expect(flags).toHaveLength(1);
  });

  it('drops only the offending entries — keeps the rest', () => {
    const flags = enforceConfidenceFloor([f(0.9), f(0.4), f(0.7)]);
    // The whole array is NOT nuked — only the <0.5 entry is dropped. This is
    // the regression contract: tightening the schema instead would have
    // failed safeParse on the whole array and triggered retry/fallback.
    expect(flags.map((x) => x.confidenceScore)).toEqual([0.9, 0.7]);
  });
});
