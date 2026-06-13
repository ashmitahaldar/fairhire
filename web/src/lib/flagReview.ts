import type { AnalysisStatus, FlagType } from '@fairhire/shared';
import type { SeverityKey } from './severity';

// View-model types the flag-review components consume. The data adapter
// (dataAdapter.ts) projects the raw GET /meetings/:id response into these.

/** FlagType enum → human-readable category label shown on flag cards. */
export const FLAG_TYPE_LABELS: Record<FlagType, string> = {
  biased_language: 'Biased language',
  criteria_drift: 'Criteria drift',
  asymmetric_concern: 'Asymmetric concern',
  hedging_language: 'Hedging language',
  age_bias: 'Age bias',
  potential_vs_performance: 'Potential vs performance',
  tenure_framing: 'Tenure framing',
  peer_comparison_bias: 'Peer-comparison bias',
  confidence_proxy: 'Confidence proxy',
};

export interface FlagVM {
  id: string;
  /** 1-based label shown as the transcript superscript + in the gutter (ids are UUIDs) */
  index: number;
  flagType: FlagType;
  /** display label from FLAG_TYPE_LABELS */
  category: string;
  /** the flagged excerpt text (Flag.excerpt) */
  span: string;
  reasoning: string;
  /** Flag.suggestedAlt — may be absent */
  suggestion: string | null;
  confidence: number;
  severityKey: SeverityKey;
  severityLabel: string;
}

// A transcript paragraph is an ordered list of segments. A segment is either
// plain text or a flagged span carrying the id of the flag it belongs to.
export type TranscriptSegment =
  | { kind: 'text'; text: string }
  | { kind: 'flag'; text: string; flagId: string };

export type TranscriptParagraph = TranscriptSegment[];

export interface AnalysisVM {
  status: AnalysisStatus;
  /** e.g. "9.2s" — null until completed */
  durationLabel: string | null;
  model: string | null;
  /** the engine does not track this; derived (transcript word count) for display */
  spansEvaluated: number | null;
  /** populated when status === 'failed' */
  error: string | null;
}

/** Database DecisionOutcome — matches the Prisma enum. */
export type DecisionOutcome = 'hired' | 'rejected' | 'in_progress';

/** Recorded outcome for this meeting's primary candidate, or null if none yet. */
export interface DecisionVM {
  /** Decision.id when persisted; null while none exists yet. */
  id: string | null;
  outcome: DecisionOutcome;
}

export interface MeetingVM {
  id: string;
  title: string;
  /** Candidate.id for the primary candidate — needed when creating a Decision. */
  candidateId: string | null;
  candidateName: string;
  candidateRole: string;
  /** formatted Meeting.date */
  panelDate: string;
  wordCount: number;
  transcript: TranscriptParagraph[];
  flags: FlagVM[];
  analysis: AnalysisVM;
  /** Current decision for the primary candidate (null id = unrecorded). */
  decision: DecisionVM;
}
