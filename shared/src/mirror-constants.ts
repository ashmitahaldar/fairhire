// Tunable thresholds for Pattern Mirror aggregation and nudge detection.
// Lives in shared so client-side empty/sparse copy and server-side gating
// agree on what counts as "enough data."

// ── Period-delta sparse handling ───────────────────────────────────────────
// If the prior window has fewer than this many total flags for the
// manager, server returns delta: null on each languageFlags row. UI
// renders a neutral pip rather than an arrow. See Section 2 of the
// Week 4 plan.
export const DELTA_PRIOR_WINDOW_MIN_FLAGS = 5;

// ── Phase B/C/D minimum-data gates ─────────────────────────────────────────
// Per-section thresholds. Below these counts, the section renders an
// inline "not enough data yet" state and the corresponding payload
// fields are still populated but the screen suppresses derivatives.

// Minimum total flags in the current window for the Language tab's
// per-type rows to be meaningful.
export const LANGUAGE_TAB_MIN_FLAGS = 3;

// Minimum interviewed candidates in the current window for the
// Demographics pipeline chart to render.
export const PIPELINE_MIN_INTERVIEWED = 3;

// ── Nudge detection thresholds (stubbed; tune from seed behaviour) ─────────
// Each rule has its own fire condition. Numbers here are conservative
// stubs; Step 7a will refine them after we see the seed data behave.

// "topCategory dominates": topCategoryCount must be at least this
// multiple of the next-most-flagged category to fire. Absolute floor on
// the top count prevents 2-vs-1 noise from triggering on tiny manager
// histories.
export const NUDGE_TOP_CATEGORY_DOMINANCE_RATIO = 2.0;
export const NUDGE_TOP_CATEGORY_MIN_COUNT = 4;

// "Category surging": current window count for a FlagType must be at
// least this many and delta must be at least this fraction of the
// prior count.
export const NUDGE_DELTA_SURGE_MIN_COUNT = 5;
export const NUDGE_DELTA_SURGE_RATIO = 0.5; // +50% over prior

// "High dismissal rate": dismissedFlags / totalFlags must exceed this
// for the dismissal nudge to fire (alongside a totalFlags floor).
export const NUDGE_DISMISSAL_RATE_THRESHOLD = 0.6;
export const NUDGE_DISMISSAL_MIN_TOTAL = 8;

// "Decisions skewing one outcome": one final outcome (Hired or Declined)
// must capture at least this fraction of final decisions, with a floor
// to avoid firing on 2-of-2 noise. Pending decisions are excluded from
// both the numerator and denominator since they aren't final yet.
export const NUDGE_DECISION_SKEW_THRESHOLD = 0.7;
export const NUDGE_DECISION_SKEW_MIN_TOTAL = 5;

// "High average flags per interview": avgFlagsPerInterview must exceed
// this with an interviews floor so a single noisy interview doesn't
// drive the nudge.
export const NUDGE_AVG_FLAGS_THRESHOLD = 3;
export const NUDGE_AVG_FLAGS_MIN_INTERVIEWS = 3;

// Max nudges surfaced per /mirror response. Section 4 of the plan.
export const NUDGE_MAX_PER_RESPONSE = 3;
