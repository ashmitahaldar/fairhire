import type { DecisionOutcome, MirrorDecisionOutcome } from './types';

// Canonical display labels for the DecisionOutcome enum. The schema enum
// is functional (hired | rejected | in_progress); these are the editorial
// labels the user sees. Single source so the three surfaces — Pattern
// Mirror summary, Flag Review decision panel, Candidates table — never
// drift apart.
//
// Typed as MirrorDecisionOutcome (not `string`) so the aggregator can use
// the map output as a MirrorDecision.outcome without a cast — the type
// system pins the labels to exactly the three allowed display values.
export const DECISION_OUTCOME_LABELS: Record<DecisionOutcome, MirrorDecisionOutcome> = {
  hired: 'Hired',
  rejected: 'Declined',
  in_progress: 'Pending',
};
