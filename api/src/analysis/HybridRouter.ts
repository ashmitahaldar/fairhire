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

function deduplicate(ruleFlags: FlagCandidate[], llmFlags: FlagCandidate[]): FlagCandidate[] {
  const merged: FlagCandidate[] = [...ruleFlags];

  for (const llmFlag of llmFlags) {
    const duplicate = ruleFlags.find(
      (r) => r.flagType === llmFlag.flagType && excerptOverlaps(r.excerpt, llmFlag.excerpt),
    );

    if (!duplicate) {
      merged.push(llmFlag);
    } else if (llmFlag.confidenceScore > duplicate.confidenceScore) {
      // Replace the rules flag with the higher-confidence LLM flag
      const idx = merged.indexOf(duplicate);
      merged[idx] = llmFlag;
    }
    // else: keep the rules flag as-is
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
