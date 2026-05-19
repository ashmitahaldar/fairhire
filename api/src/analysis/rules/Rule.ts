import type { FlagType } from '@fairhire/shared';
import type { FlagCandidate } from '../types';

export interface PhraseEntry {
  pattern: string | RegExp;
  confidence: number;
  reasoning: string;
  suggestedAlt?: string;
}

// Extracts the sentence containing the match as the excerpt.
export function extractExcerpt(transcript: string, matchIndex: number, matchLength: number): string {
  const start = transcript.lastIndexOf('.', matchIndex);
  const sentenceStart = start === -1 ? 0 : start + 1;
  const end = transcript.indexOf('.', matchIndex + matchLength);
  const sentenceEnd = end === -1 ? transcript.length : end + 1;
  return transcript.slice(sentenceStart, sentenceEnd).trim();
}

export abstract class Rule {
  abstract readonly id: string;
  abstract readonly flagType: FlagType;
  protected abstract readonly phrases: PhraseEntry[];

  match(transcript: string): FlagCandidate[] {
    // Keyed by excerpt so overlapping phrases on the same sentence collapse
    // to a single flag — the highest-confidence one wins.
    const byExcerpt = new Map<string, FlagCandidate>();

    for (const entry of this.phrases) {
      const source = entry.pattern instanceof RegExp ? entry.pattern.source : entry.pattern;
      const baseFlags =
        entry.pattern instanceof RegExp ? entry.pattern.flags.replace('g', '') : 'i';
      // Always global so matchAll iterates instead of looping on the same match.
      const re = new RegExp(source, baseFlags.includes('g') ? baseFlags : baseFlags + 'g');

      for (const m of transcript.matchAll(re)) {
        const idx = m.index ?? 0;
        const excerpt = extractExcerpt(transcript, idx, m[0].length);
        const existing = byExcerpt.get(excerpt);
        if (existing && existing.confidenceScore >= entry.confidence) continue;
        byExcerpt.set(excerpt, {
          flagType: this.flagType,
          excerpt,
          reasoning: entry.reasoning,
          confidenceScore: entry.confidence,
          suggestedAlt: entry.suggestedAlt,
        });
      }
    }

    return [...byExcerpt.values()];
  }
}
