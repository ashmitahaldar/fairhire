import {
  FLAG_TYPE_LABELS,
  HR_NUDGE_COMPOSITION_MIN_APPLIED,
  HR_NUDGE_COMPOSITION_SHIFT_PP,
  HR_NUDGE_DISMISSAL_MIN_TYPE_TOTAL,
  HR_NUDGE_DISMISSAL_RATE_THRESHOLD,
  HR_NUDGE_MAX_PER_RESPONSE,
  HR_NUDGE_SURGE_MIN_COUNT,
  HR_NUDGE_SURGE_RATIO,
  HR_NUDGE_TOP_CATEGORY_DOMINANCE_RATIO,
  HR_NUDGE_TOP_CATEGORY_MIN_COUNT,
  type HrDemographicsResponse,
  type HrFlagTypeCount,
  type HrFlagsResponse,
  type MirrorNudge,
} from '@fairhire/shared';

// Org-level nudge rules — the HR sibling of api/src/mirror/nudges.ts. Each rule
// is a pure function over the already-aggregated HR responses and returns a
// candidate nudge with a severity, or null. The orchestrator collects firings,
// sorts by severity desc, and returns the top N.
//
// Two things distinguish these from the Mirror's rules:
//   1. Voice — third-person org ("Across the organisation…"), never "you". No
//      individual manager, candidate, or excerpt is referenced; the inputs are
//      org-level counts only, so re-identification is structurally impossible.
//   2. Floors — org N is larger than a single manager's, so the absolute-count
//      thresholds (HR_NUDGE_* in shared/hr-constants.ts) are higher to avoid
//      firing on what is, at org scale, noise.

export interface HrNudgeInputs {
  flags: HrFlagsResponse;
  demographics: HrDemographicsResponse;
}

interface RuleResult {
  nudge: MirrorNudge;
  severity: number; // higher = surfaced first when more than N fire
}

type Rule = (input: HrNudgeInputs) => RuleResult | null;

// ── Rule 1: Org-dominant flag category ────────────────────────────────────
// Fires when the most-flagged category org-wide is materially out in front
// (≥ 2× the next). Absolute floor on the top count so a 2-vs-1 lead in a quiet
// org doesn't trigger. Sorts a copy rather than trusting input order.
const orgDominantCategory: Rule = ({ flags }) => {
  const sorted = [...flags.byType].sort((a, b) => b.count - a.count);
  if (sorted.length < 2) return null;

  const top = sorted[0]!;
  const next = sorted[1]!;
  if (top.count < HR_NUDGE_TOP_CATEGORY_MIN_COUNT) return null;
  if (next.count === 0) return null;
  if (top.count < next.count * HR_NUDGE_TOP_CATEGORY_DOMINANCE_RATIO) return null;

  // Floor to one decimal so the headline never rounds UP — Math.round turns a
  // 2.5× lead into "3×", over-stating exactly the way the conservative-by-design
  // thresholds are meant to avoid. Sort on the true ratio, not the display value.
  const multiple = top.count / next.count;
  const display = (Math.floor(multiple * 10) / 10).toFixed(1);
  return {
    nudge: {
      id: 'hr-top-category-dominance',
      tag: 'Organisation · language',
      sentence: `Across the organisation, "${FLAG_TYPE_LABELS[top.type]}" is the most-flagged category this period — ${display}× the next most common. Worth checking whether the bar is applied evenly across candidates.`,
      linkTo: 'Flags',
    },
    severity: multiple,
  };
};

// ── Rule 2: Category surging period-over-period (org-wide) ─────────────────
// Picks the flag type whose org count rose most, relative to its prior window.
// Skips sparse rows (delta null) and rows below the absolute current floor.
const orgCategorySurge: Rule = ({ flags }) => {
  let best: { row: HrFlagTypeCount; relative: number } | null = null;
  for (const row of flags.byType) {
    if (row.delta === null || row.delta <= 0) continue;
    if (row.count < HR_NUDGE_SURGE_MIN_COUNT) continue;
    const prior = row.count - row.delta;
    if (prior <= 0) continue; // can't compute relative surge from a zero baseline
    const relative = row.delta / prior;
    if (relative < HR_NUDGE_SURGE_RATIO) continue;
    if (!best || relative > best.relative) best = { row, relative };
  }
  if (!best) return null;

  return {
    nudge: {
      id: 'hr-category-surge',
      tag: 'Organisation · language',
      sentence: `"${FLAG_TYPE_LABELS[best.row.type]}" flags are up ${best.row.delta} across the organisation vs last period — worth a look before the pattern sets in.`,
      linkTo: 'Flags',
    },
    severity: best.relative,
  };
};

// ── Rule 3: Dismissal rate by flag type ───────────────────────────────────
// The genuinely HR-only signal: a flag type that managers dismiss most of the
// time may not be credible to them (or is being systematically waved off).
// Per-type (not org-total) with a per-type floor, so one noisy category is
// named rather than diluted into an overall rate.
const dismissalRateByType: Rule = ({ flags }) => {
  let best: { row: HrFlagTypeCount; rate: number } | null = null;
  for (const row of flags.byType) {
    if (row.count < HR_NUDGE_DISMISSAL_MIN_TYPE_TOTAL) continue;
    const rate = row.dismissed / row.count;
    if (rate < HR_NUDGE_DISMISSAL_RATE_THRESHOLD) continue;
    if (!best || rate > best.rate) best = { row, rate };
  }
  if (!best) return null;

  const pct = Math.round(best.rate * 100);
  return {
    nudge: {
      id: 'hr-dismissal-rate-by-type',
      tag: 'Organisation · calibration',
      sentence: `"${FLAG_TYPE_LABELS[best.row.type]}" flags are dismissed ${pct}% of the time org-wide — ${best.row.dismissed} of ${best.row.count}. Worth checking whether managers find that signal credible.`,
      linkTo: 'Flags',
    },
    severity: best.rate,
  };
};

// ── Rule 4: Composition shift at hire (org-wide) ──────────────────────────
// Compares the majority share of the applied pool to the majority share of
// hires. "Majority" follows the Mirror / ConversionGrid convention: Chinese =
// majority; Malay + Indian + Other = represented; 'unknown' is excluded from
// the denominator (incomplete data, not a group). Floored by a minimum
// known-demographic applied pool so a small or mostly-unknown pool can't drive
// the signal.
const compositionShiftAtHire: Rule = ({ demographics }) => {
  let appliedMajority = 0;
  let appliedKnown = 0;
  let hiredMajority = 0;
  let hiredKnown = 0;

  for (const r of demographics.byRace) {
    if (r.race === 'unknown') continue;
    appliedKnown += r.applied;
    hiredKnown += r.hired;
    if (r.race === 'chinese') {
      appliedMajority += r.applied;
      hiredMajority += r.hired;
    }
  }

  if (appliedKnown < HR_NUDGE_COMPOSITION_MIN_APPLIED) return null;
  if (hiredKnown === 0) return null;

  const appliedPct = Math.round((appliedMajority / appliedKnown) * 100);
  const hiredPct = Math.round((hiredMajority / hiredKnown) * 100);
  const shiftPp = hiredPct - appliedPct;
  if (shiftPp < HR_NUDGE_COMPOSITION_SHIFT_PP) return null;

  return {
    nudge: {
      id: 'hr-composition-shift',
      tag: 'Organisation · representation',
      sentence: `Hires this period were ${hiredPct}% majority background vs an applied pool of ${appliedPct}%.`,
      linkTo: 'Demographics',
    },
    severity: shiftPp,
  };
};

// Registered in arbitrary order — the orchestrator's severity sort decides
// display order. Note severities are not on a common scale across rules (a pp
// gap vs a ratio vs a rate); with 4 rules and a cap of 3, this only ever
// affects which single rule is dropped, matching the Mirror's accepted
// trade-off. Adding a rule is one append here.
const RULES: Rule[] = [
  orgDominantCategory,
  orgCategorySurge,
  dismissalRateByType,
  compositionShiftAtHire,
];

// Public orchestrator. Runs every rule, sorts firings by severity desc, returns
// up to HR_NUDGE_MAX_PER_RESPONSE.
export function buildHrNudges(input: HrNudgeInputs): MirrorNudge[] {
  const fired: RuleResult[] = [];
  for (const rule of RULES) {
    const r = rule(input);
    if (r) fired.push(r);
  }
  fired.sort((a, b) => b.severity - a.severity);
  return fired.slice(0, HR_NUDGE_MAX_PER_RESPONSE).map((r) => r.nudge);
}
