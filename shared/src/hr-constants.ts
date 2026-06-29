// Tunable thresholds for the HR org-level nudge engine (api/src/hr/nudges.ts).
// Deliberately SEPARATE from mirror-constants.ts: those gate a single manager's
// history, whereas these gate organisation-wide aggregates where the total N is
// much larger. Reusing the Mirror's floors verbatim would let an org-level
// nudge fire on what is, at org scale, noise — so the absolute-count floors
// here are higher. Like the Mirror's, these start conservative; tune once we
// see real org behaviour. See [[mirror-nudge-thresholds-stub]].

// "Org-dominant category": the most-flagged type must be at least this multiple
// of the next-most-flagged to fire, with an absolute floor on the top count so
// a 2-vs-1 lead in a quiet org doesn't trigger.
export const HR_NUDGE_TOP_CATEGORY_DOMINANCE_RATIO = 2.0;
export const HR_NUDGE_TOP_CATEGORY_MIN_COUNT = 8;

// "Org category surge": a flag type's current-window org count must clear this
// floor AND its rise vs the prior window must be at least this fraction of the
// prior count. (delta is null when the prior window is too sparse to compare.)
export const HR_NUDGE_SURGE_MIN_COUNT = 8;
export const HR_NUDGE_SURGE_RATIO = 0.5; // +50% over prior

// "Dismissal rate by type": for a single flag type, dismissed / count must
// exceed this rate (with a per-type count floor) before we suggest managers may
// not find that signal credible. Per-type, not org-total, so a high overall
// dismissal rate driven by one noisy category surfaces that category.
export const HR_NUDGE_DISMISSAL_RATE_THRESHOLD = 0.6;
export const HR_NUDGE_DISMISSAL_MIN_TYPE_TOTAL = 6;

// "Composition shift at hire": how much higher (percentage points) the majority
// share of hires is vs the majority share of the applied pool before the rule
// fires, floored by a minimum known-demographic applied pool so a tiny or
// mostly-unknown pool can't drive the signal.
export const HR_NUDGE_COMPOSITION_SHIFT_PP = 15;
export const HR_NUDGE_COMPOSITION_MIN_APPLIED = 10;

// Max nudges surfaced per /hr/nudges response.
export const HR_NUDGE_MAX_PER_RESPONSE = 3;
