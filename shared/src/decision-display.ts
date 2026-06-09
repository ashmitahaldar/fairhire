import type { DecisionOutcome } from './types';

// Canonical display labels for the DecisionOutcome enum. The schema enum
// is functional (hired | rejected | in_progress); these are the editorial
// labels the user sees. Single source so the three surfaces — Pattern
// Mirror summary, Flag Review decision panel, Candidates table — never
// drift apart.
export const DECISION_OUTCOME_LABELS: Record<DecisionOutcome, string> = {
  hired: 'Hired',
  rejected: 'Declined',
  in_progress: 'Pending',
};
