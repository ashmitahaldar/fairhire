import type {
  DecisionOutcome,
  HiringDecisionOutcome,
  MeetingType,
  MirrorDecisionOutcome,
} from './types';

// Canonical display labels for the DecisionOutcome enum, indexed by
// meeting mode (Section 3 of the Week 5 plan). One DecisionOutcome may
// have two display labels depending on the parent meeting's
// meetingType — `in_progress` is "Pending" in both, but `hired` only
// makes sense in hiring mode and `promoted` only in promotion mode.
//
// The aggregator uses `[meetingType].in_progress` etc. to render the
// Decisions tab, the Flag Review decision panel uses it to populate
// the button trio, and the Candidates table uses it for the outcome
// chip on each row.
//
// Typed as MirrorDecisionOutcome (not `string`) so the aggregator can
// use the map output as a MirrorDecision.outcome without a cast — the
// type system pins the labels to the allowed display values.
export const DECISION_OUTCOME_LABELS_BY_MODE: Record<
  MeetingType,
  Partial<Record<DecisionOutcome, MirrorDecisionOutcome>>
> = {
  hiring: {
    hired: 'Hired',
    rejected: 'Declined',
    in_progress: 'Pending',
  },
  promotion: {
    promoted: 'Promoted',
    held: 'Held',
    in_progress: 'Pending',
  },
};

// Which DecisionOutcomes the Decision Panel offers per mode, in the
// canonical display order (positive → neutral → negative). Drives the
// button trio in DecisionPanel.tsx and validation on the write path.
export const DECISION_OUTCOMES_BY_MODE: Record<MeetingType, DecisionOutcome[]> = {
  hiring: ['hired', 'in_progress', 'rejected'],
  promotion: ['promoted', 'in_progress', 'held'],
};

// Legacy hiring-only map. Kept strictly typed on HiringDecisionOutcome
// so callers like DecisionPanel.tsx and the Mirror aggregator (both
// hiring-only until Step 6) can index without an undefined possibility.
// Mode-aware surfaces should use decisionOutcomeLabel() instead.
export const DECISION_OUTCOME_LABELS: Record<HiringDecisionOutcome, MirrorDecisionOutcome> = {
  hired: 'Hired',
  rejected: 'Declined',
  in_progress: 'Pending',
};

// Canonical label for every DecisionOutcome, mode-independent. The
// per-mode maps above carry identical labels for each outcome — the
// mode only restricts *which* outcomes are offered — so this is the
// single source for "what does this outcome read as on screen."
const CANONICAL_OUTCOME_LABELS: Record<DecisionOutcome, MirrorDecisionOutcome> = {
  hired: 'Hired',
  rejected: 'Declined',
  in_progress: 'Pending',
  promoted: 'Promoted',
  held: 'Held',
};

// Resolve a DecisionOutcome to its display label for a given meeting
// mode. Prefers the mode's own label; if the outcome doesn't belong to
// that mode (legacy or mismatched data, e.g. a `hired` decision on a
// promotion meeting), falls back to the outcome's canonical label
// rather than silently mislabelling it. Every mode-aware surface (the
// Mirror aggregator, the Candidates table) should use this instead of
// indexing the hiring-only DECISION_OUTCOME_LABELS.
export function decisionOutcomeLabel(
  meetingType: MeetingType,
  outcome: DecisionOutcome,
): MirrorDecisionOutcome {
  return DECISION_OUTCOME_LABELS_BY_MODE[meetingType][outcome] ?? CANONICAL_OUTCOME_LABELS[outcome];
}
