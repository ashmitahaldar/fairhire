import { RulesEngine } from './RulesEngine';
import { LLMAnalyser } from './llm/LLMAnalyser';
import type { FlagCandidate } from './types';

// Two excerpts are the "same finding" only if one contains the other AND the
// shorter is a substantial fraction of the longer. Bare containment alone
// over-merges: a short LLM phrase can sit inside an unrelated long rule
// sentence and get wrongly collapsed.
const MIN_OVERLAP_RATIO = 0.5;

function excerptOverlaps(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na.includes(nb) && !nb.includes(na)) return false;
  const shorter = Math.min(na.length, nb.length);
  const longer = Math.max(na.length, nb.length);
  return longer > 0 && shorter / longer >= MIN_OVERLAP_RATIO;
}

export function deduplicate(ruleFlags: FlagCandidate[], llmFlags: FlagCandidate[]): FlagCandidate[] {
  const merged: FlagCandidate[] = [...ruleFlags];

  for (const llmFlag of llmFlags) {
    // Search merged, not ruleFlags: a later overlapping LLM flag must compare
    // against whatever currently occupies that slot (a rule flag OR an
    // already-applied higher-confidence LLM flag), so the highest-confidence
    // candidate always wins regardless of LLM ordering.
    const duplicate = merged.find(
      (r) => r.flagType === llmFlag.flagType && excerptOverlaps(r.excerpt, llmFlag.excerpt),
    );

    if (!duplicate) {
      merged.push(llmFlag);
    } else if (llmFlag.confidenceScore > duplicate.confidenceScore) {
      // Replace the lower-confidence flag (rule or LLM) currently in merged.
      merged[merged.indexOf(duplicate)] = llmFlag;
    }
    // else: keep the existing merged flag as-is
  }

  return merged;
}

export class HybridRouter {
  private rulesEngine = new RulesEngine();
  private llmAnalyser = new LLMAnalyser();

  get modelVersion(): string {
    return this.llmAnalyser.modelVersion;
  }

  async analyse(transcript: string): Promise<{ flags: FlagCandidate[]; llmOk: boolean }> {
    const ruleFlags = this.rulesEngine.run(transcript);
    const { flags: llmFlags, ok: llmOk } = await this.llmAnalyser.analyse(transcript);
    return { flags: deduplicate(ruleFlags, llmFlags), llmOk };
  }
}
