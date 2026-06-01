import type { FlagType } from '@fairhire/shared';

// Pure scoring helpers for the eval script (api/src/analysis/eval/run.ts). No
// I/O — unit tested in api/src/__tests__/evalMetrics.test.ts.

// ── Span matching ────────────────────────────────────────────────────────────
// A predicted flag matches a labelled (ground-truth) flag iff they share the
// same flagType AND their excerpts overlap by >= OVERLAP_THRESHOLD, measured as
// the longest common substring over the shorter excerpt's length. This is
// deliberately more lenient than the engine's internal dedup (HybridRouter's
// excerptOverlaps requires full containment): for scoring we want to credit a
// near-miss span as a match, not penalise the engine for a few extra words.

export const OVERLAP_THRESHOLD = 0.5;

export interface ScorableFlag {
  flagType: FlagType;
  excerpt: string;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function longestCommonSubstring(a: string, b: string): number {
  if (!a || !b) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  let best = 0;
  for (let i = 1; i <= a.length; i++) {
    const curr = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        if (curr[j] > best) best = curr[j];
      }
    }
    prev = curr;
  }
  return best;
}

/** Character overlap of two excerpts: LCS length over the shorter, in [0, 1]. */
export function spanOverlap(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  const shorter = Math.min(na.length, nb.length);
  if (shorter === 0) return 0;
  return longestCommonSubstring(na, nb) / shorter;
}

// ── Precision / recall / F1 ──────────────────────────────────────────────────

export interface Counts {
  tp: number;
  fp: number;
  fn: number;
}

export interface PRF {
  precision: number | null;
  recall: number | null;
  f1: number | null;
}

// Generic over the flag shapes so callers get their own rich objects back in
// the unmatched lists (e.g. predicted FlagCandidates with confidence/reasoning,
// ground-truth Flags) — not just counts.
export interface MatchResult<P extends ScorableFlag, G extends ScorableFlag> extends Counts {
  /** predictions that matched no ground-truth flag (false positives) */
  falsePositives: P[];
  /** ground-truth flags that matched no prediction (false negatives) */
  falseNegatives: G[];
}

/** Greedy 1:1 matching — each ground-truth flag matches at most one prediction. */
export function matchFlags<P extends ScorableFlag, G extends ScorableFlag>(
  predicted: P[],
  groundTruth: G[],
): MatchResult<P, G> {
  const usedGt = new Set<number>();
  const falsePositives: P[] = [];
  let tp = 0;
  for (const p of predicted) {
    let matched = false;
    for (let i = 0; i < groundTruth.length; i++) {
      if (usedGt.has(i)) continue;
      const g = groundTruth[i];
      if (g.flagType === p.flagType && spanOverlap(p.excerpt, g.excerpt) >= OVERLAP_THRESHOLD) {
        usedGt.add(i);
        tp += 1;
        matched = true;
        break;
      }
    }
    if (!matched) falsePositives.push(p);
  }
  const falseNegatives = groundTruth.filter((_, i) => !usedGt.has(i));
  return { tp, fp: falsePositives.length, fn: falseNegatives.length, falsePositives, falseNegatives };
}

export function addCounts(a: Counts, b: Counts): Counts {
  return { tp: a.tp + b.tp, fp: a.fp + b.fp, fn: a.fn + b.fn };
}

// null where the metric is undefined (no predictions → precision; no ground
// truth → recall), rather than a misleading 0 or 1.
export function computePRF({ tp, fp, fn }: Counts): PRF {
  const precision = tp + fp === 0 ? null : tp / (tp + fp);
  const recall = tp + fn === 0 ? null : tp / (tp + fn);
  const f1 =
    precision === null || recall === null || precision + recall === 0
      ? null
      : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

// ── Fairness ─────────────────────────────────────────────────────────────────

export type DemographicDimension = 'race' | 'gender' | 'ageBand' | 'nationalityStatus';

export const DEMOGRAPHIC_DIMENSIONS: DemographicDimension[] = [
  'race',
  'gender',
  'ageBand',
  'nationalityStatus',
];

export interface CandidateFlagging {
  demographics: Partial<Record<DemographicDimension, string | null>>;
  flagCount: number;
}

export interface GroupStat {
  value: string;
  n: number;
  flaggedCandidates: number;
  totalFlags: number;
}

/** Flag totals per value of one demographic dimension. Missing → "unknown". */
export function fairnessByDimension(
  candidates: CandidateFlagging[],
  dim: DemographicDimension,
): GroupStat[] {
  const groups = new Map<string, GroupStat>();
  for (const c of candidates) {
    const value = c.demographics[dim] ?? 'unknown';
    let g = groups.get(value);
    if (!g) {
      g = { value, n: 0, flaggedCandidates: 0, totalFlags: 0 };
      groups.set(value, g);
    }
    g.n += 1;
    g.totalFlags += c.flagCount;
    if (c.flagCount > 0) g.flaggedCandidates += 1;
  }
  return [...groups.values()].sort((a, b) => b.totalFlags - a.totalFlags);
}
