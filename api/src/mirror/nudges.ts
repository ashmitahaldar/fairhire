import {
  NUDGE_AVG_FLAGS_MIN_INTERVIEWS,
  NUDGE_AVG_FLAGS_THRESHOLD,
  NUDGE_DECISION_SKEW_MIN_TOTAL,
  NUDGE_DECISION_SKEW_THRESHOLD,
  NUDGE_DELTA_SURGE_MIN_COUNT,
  NUDGE_DELTA_SURGE_RATIO,
  NUDGE_DISMISSAL_MIN_TOTAL,
  NUDGE_DISMISSAL_RATE_THRESHOLD,
  NUDGE_MAX_PER_RESPONSE,
  NUDGE_PHASE_C_COMPOSITION_SHIFT_PP,
  NUDGE_PHASE_C_MIN_APPLIED_TOTAL,
  NUDGE_PHASE_C_MIN_PER_GROUP,
  NUDGE_PHASE_C_STAGE_GAP_PP,
  NUDGE_TOP_CATEGORY_DOMINANCE_RATIO,
  NUDGE_TOP_CATEGORY_MIN_COUNT,
  type LanguageFlagRow,
  type MeetingType,
  type MirrorDecision,
  type MirrorNudge,
  type MirrorSummary,
  type PipelineRow,
} from '@fairhire/shared';

// Phase D nudge rules. Each rule is a pure function over the aggregated
// signals — given inputs, returns either a candidate nudge with its own
// severity score or null. The orchestrator (`buildNudges`) collects every
// non-null result, sorts by severity desc, and returns the top N per
// NUDGE_MAX_PER_RESPONSE. No persistence, no LLM — copy is templated with
// {placeholder} interpolation per Section 4 of the Week 4 plan.

export interface NudgeInputs {
  summary: MirrorSummary;
  languageFlags: LanguageFlagRow[];   // already sorted by count desc
  decisions: MirrorDecision[];
  // Week 5 Step 7 — Phase C nudges need the funnel + the active mode so
  // they can bail in promotion (no pipeline concept) and reach into the
  // per-stage segment counts when in hiring mode.
  pipeline: PipelineRow[];
  meetingType: MeetingType;
}

interface RuleResult {
  nudge: MirrorNudge;
  severity: number; // higher = surfaced first when more than N fire
}

type Rule = (input: NudgeInputs) => RuleResult | null;

// ── Rule 1: Top category dominance ────────────────────────────────────────
// Fires when the most-flagged language category is materially out in front
// (≥ 2× the next-most-flagged). Floors absolute count so 2-vs-1 noise
// doesn't trigger the copy.
const topCategoryDominance: Rule = ({ summary, languageFlags }) => {
  if (summary.topCategoryCount < NUDGE_TOP_CATEGORY_MIN_COUNT) return null;
  if (languageFlags.length < 2) return null;

  const top = languageFlags[0]!;
  const next = languageFlags[1]!;
  if (next.count === 0) return null;
  if (top.count < next.count * NUDGE_TOP_CATEGORY_DOMINANCE_RATIO) return null;

  const ratio = Math.round(top.count / next.count);
  return {
    nudge: {
      id: 'top-category-dominance',
      tag: 'Language · self-pattern',
      sentence: `"${summary.topCategory}" appears ${ratio}× more often than your next most-flagged category. Worth checking whether the bar is the same across candidates.`,
      linkTo: 'Language',
    },
    severity: ratio,
  };
};

// ── Rule 2: Category surging period-over-period ──────────────────────────
// Fires on a language row whose current count is materially above the
// prior period. Skips sparse rows (delta is null when prior was thin) and
// rows that didn't clear the absolute current-count floor.
const categorySurging: Rule = ({ languageFlags }) => {
  let best: { row: LanguageFlagRow; relative: number } | null = null;
  for (const row of languageFlags) {
    if (row.delta === null || row.delta <= 0) continue;
    if (row.count < NUDGE_DELTA_SURGE_MIN_COUNT) continue;
    const prior = row.count - row.delta;
    if (prior <= 0) continue; // can't compute relative surge from a zero baseline
    const relative = row.delta / prior;
    if (relative < NUDGE_DELTA_SURGE_RATIO) continue;
    if (!best || relative > best.relative) {
      best = { row, relative };
    }
  }
  if (!best) return null;

  return {
    nudge: {
      id: 'category-surging',
      tag: 'Language · self-pattern',
      sentence: `Flags for "${best.row.label}" are up ${best.row.delta} from last period. The pattern may be worth pausing on before it sets in.`,
      linkTo: 'Language',
    },
    severity: best.relative,
  };
};

// ── Rule 3: High dismissal rate ───────────────────────────────────────────
// Fires when a large share of flags are dismissed, with a floor on
// totalFlags so a manager with 3-of-4 dismissed doesn't trigger.
const highDismissalRate: Rule = ({ summary }) => {
  const { dismissedFlags, totalFlags } = summary;
  if (totalFlags < NUDGE_DISMISSAL_MIN_TOTAL) return null;
  const rate = dismissedFlags / totalFlags;
  if (rate < NUDGE_DISMISSAL_RATE_THRESHOLD) return null;

  const pct = Math.round(rate * 100);
  return {
    nudge: {
      id: 'high-dismissal-rate',
      tag: 'Language · self-pattern',
      sentence: `You dismissed ${pct}% of flags this period — ${dismissedFlags} of ${totalFlags}. High dismissal can be a useful filter, but worth occasionally revisiting which ones you waved off.`,
      linkTo: 'Language',
    },
    severity: rate,
  };
};

// ── Rule 4: Decisions skewing one outcome ─────────────────────────────────
// Pending decisions are excluded — they're not final, and including them
// would conflate "I lean toward declining" with "I haven't decided." The
// rule speaks to calibration of *closed* decisions only.
const decisionsSkewing: Rule = ({ decisions }) => {
  const final = decisions.filter(
    (d) => d.outcome === 'Hired' || d.outcome === 'Declined',
  );
  if (final.length < NUDGE_DECISION_SKEW_MIN_TOTAL) return null;

  const counts: Record<string, number> = {};
  for (const d of final) counts[d.outcome] = (counts[d.outcome] ?? 0) + 1;

  let topOutcome: string | null = null;
  let topCount = 0;
  for (const [o, c] of Object.entries(counts)) {
    if (c > topCount) {
      topCount = c;
      topOutcome = o;
    }
  }
  if (!topOutcome) return null;

  const skew = topCount / final.length;
  if (skew < NUDGE_DECISION_SKEW_THRESHOLD) return null;

  const pct = Math.round(skew * 100);
  return {
    nudge: {
      id: 'decisions-skewing',
      tag: 'Decisions · velocity',
      sentence: `${pct}% of your recent decisions were ${topOutcome}. A pattern across roles can be a useful check on whether you're calibrated to a job or to a candidate.`,
      linkTo: 'Decisions',
    },
    severity: skew,
  };
};

// ── Rule 5: High average flags per interview ──────────────────────────────
const highAvgFlags: Rule = ({ summary }) => {
  const { avgFlagsPerInterview, interviewsCount } = summary;
  if (interviewsCount < NUDGE_AVG_FLAGS_MIN_INTERVIEWS) return null;
  if (avgFlagsPerInterview < NUDGE_AVG_FLAGS_THRESHOLD) return null;

  return {
    nudge: {
      id: 'high-avg-flags',
      tag: 'Language · self-pattern',
      sentence: `You're averaging ${avgFlagsPerInterview} flags per interview across ${interviewsCount} this period. Higher-than-usual flag rates can mean candidates have changed, or that what you're noticing has.`,
      linkTo: 'Language',
    },
    severity: avgFlagsPerInterview,
  };
};

// ── Phase C helpers ───────────────────────────────────────────────────────
// Convention from web/src/components/pattern-mirror/ConversionGrid.tsx:
//   majority    = chinese
//   represented = malay + indian + other
//   unknown     excluded from both — incomplete data, not a fifth group.
//
// Pulled out as helpers because both Phase C rules read the same
// per-stage breakdown.

interface GroupBreakdown {
  majority: number;
  represented: number;
}

function groupsForStage(row: PipelineRow | undefined): GroupBreakdown {
  if (!row) return { majority: 0, represented: 0 };
  const s = row.segments;
  return {
    majority: s.chinese,
    represented: s.malay + s.indian + s.other,
  };
}

function findStage(pipeline: PipelineRow[], stage: string): PipelineRow | undefined {
  return pipeline.find((r) => r.stage === stage);
}

// ── Rule 6: Stage drop-off gap (Phase C, hiring-only) ─────────────────────
// Walks the funnel's advance transitions (Applied → Interviewed,
// Interviewed → Hired) and picks the one where represented candidates
// drop off most sharply relative to majority. Rejected is a parallel
// terminal state, not a drop-off step, so it's not considered.
//
// Drop-off pct for a group = (from_count - to_count) / from_count.
// Gap = represented_dropoff_pct - majority_dropoff_pct (in pp).
// Fires only when both groups have ≥ MIN_PER_GROUP at the "from" stage
// AND the gap exceeds STAGE_GAP_PP.
const ADVANCE_TRANSITIONS: Array<[from: string, to: string]> = [
  ['Applied', 'Interviewed'],
  ['Interviewed', 'Hired'],
];

const stageDropoffGap: Rule = ({ pipeline, meetingType }) => {
  if (meetingType !== 'hiring') return null;

  let best: { from: string; to: string; gapPp: number } | null = null;

  for (const [from, to] of ADVANCE_TRANSITIONS) {
    const fromGroups = groupsForStage(findStage(pipeline, from));
    const toGroups = groupsForStage(findStage(pipeline, to));

    if (fromGroups.majority < NUDGE_PHASE_C_MIN_PER_GROUP) continue;
    if (fromGroups.represented < NUDGE_PHASE_C_MIN_PER_GROUP) continue;

    const majDropoff = (fromGroups.majority - toGroups.majority) / fromGroups.majority;
    const repDropoff =
      (fromGroups.represented - toGroups.represented) / fromGroups.represented;

    const gapPp = Math.round((repDropoff - majDropoff) * 100);
    if (gapPp < NUDGE_PHASE_C_STAGE_GAP_PP) continue;

    if (!best || gapPp > best.gapPp) {
      best = { from, to, gapPp };
    }
  }

  if (!best) return null;

  return {
    nudge: {
      id: 'phase-c-stage-dropoff',
      tag: 'Pipeline · representation',
      sentence: `Represented candidates drop off most sharply between ${best.from} and ${best.to} — a ${best.gapPp}pp gap vs majority candidates.`,
      linkTo: 'Demographics',
    },
    severity: best.gapPp,
  };
};

// ── Rule 7: Composition shift at hire (Phase C, hiring-only) ─────────────
// Compares the majority share of the applied pool to the majority share
// of hires. Fires when the share rises by more than COMPOSITION_SHIFT_PP,
// floored by MIN_APPLIED_TOTAL so a tiny applied pool can't drive the
// signal.
const compositionShiftAtHire: Rule = ({ pipeline, meetingType }) => {
  if (meetingType !== 'hiring') return null;

  const applied = findStage(pipeline, 'Applied');
  const hired = findStage(pipeline, 'Hired');
  if (!applied || !hired) return null;

  // Use majority + represented as the denominator (exclude 'unknown'
  // candidates so the share isn't diluted by missing demographics).
  const appliedGroups = groupsForStage(applied);
  const hiredGroups = groupsForStage(hired);

  const appliedKnown = appliedGroups.majority + appliedGroups.represented;
  const hiredKnown = hiredGroups.majority + hiredGroups.represented;

  if (appliedKnown < NUDGE_PHASE_C_MIN_APPLIED_TOTAL) return null;
  if (hiredKnown === 0) return null;

  const appliedMajorityPct = Math.round((appliedGroups.majority / appliedKnown) * 100);
  const hiredMajorityPct = Math.round((hiredGroups.majority / hiredKnown) * 100);
  const shiftPp = hiredMajorityPct - appliedMajorityPct;

  if (shiftPp < NUDGE_PHASE_C_COMPOSITION_SHIFT_PP) return null;

  return {
    nudge: {
      id: 'phase-c-composition-shift',
      tag: 'Pipeline · representation',
      sentence: `Your hires this period were ${hiredMajorityPct}% majority background vs your applied pool of ${appliedMajorityPct}%.`,
      linkTo: 'Demographics',
    },
    severity: shiftPp,
  };
};

// All rules registered here in arbitrary order — the orchestrator's
// severity sort is what determines display order. Adding a new rule is
// one append to this array.
const RULES: Rule[] = [
  topCategoryDominance,
  categorySurging,
  highDismissalRate,
  decisionsSkewing,
  highAvgFlags,
  stageDropoffGap,
  compositionShiftAtHire,
];

// Public orchestrator. Runs every rule, collects firings, sorts by
// severity desc, returns up to NUDGE_MAX_PER_RESPONSE.
export function buildNudges(input: NudgeInputs): MirrorNudge[] {
  const fired: RuleResult[] = [];
  for (const rule of RULES) {
    const r = rule(input);
    if (r) fired.push(r);
  }
  fired.sort((a, b) => b.severity - a.severity);
  return fired.slice(0, NUDGE_MAX_PER_RESPONSE).map((r) => r.nudge);
}
