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
// Mode-aware surfaces should use DECISION_OUTCOME_LABELS_BY_MODE instead.
export const DECISION_OUTCOME_LABELS: Record<HiringDecisionOutcome, MirrorDecisionOutcome> = {
  hired: 'Hired',
  rejected: 'Declined',
  in_progress: 'Pending',
};
