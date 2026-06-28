import { Gavel } from 'lucide-react';
import {
  DECISION_OUTCOMES_BY_MODE,
  DECISION_OUTCOME_LABELS_BY_MODE,
  type MeetingType,
} from '@fairhire/shared';
import { ApiError } from '../../lib/api';
import { useUpsertDecision } from '../../lib/decisionsApi';
import type { DecisionOutcome, DecisionVM } from '../../lib/flagReview';

interface DecisionPanelProps {
  meetingId: string;
  meetingType: MeetingType;
  candidateId: string | null;
  decision: DecisionVM;
}

// Compact 3-state outcome control. Clicking a button saves immediately —
// no submit step — so the panel doubles as both display and edit affordance.
// Mode-aware in Week 5: hiring renders Hired/Pending/Declined, promotion
// renders Promoted/Pending/Held. The button order (positive → neutral →
// negative) comes from DECISION_OUTCOMES_BY_MODE in shared.
//
// Disabled when there's no primary candidate to attach a decision to
// (defensive: should never happen for a real meeting created via the
// upload form, which requires at least one candidate).
export function DecisionPanel({
  meetingId,
  meetingType,
  candidateId,
  decision,
}: DecisionPanelProps) {
  const upsert = useUpsertDecision();
  const pending = upsert.isPending;
  const disabled = !candidateId || pending;

  const options: Array<{ value: DecisionOutcome; label: string }> = DECISION_OUTCOMES_BY_MODE[
    meetingType
  ].map((value) => ({
    value,
    label: DECISION_OUTCOME_LABELS_BY_MODE[meetingType][value] ?? value,
  }));

  const onPick = (outcome: DecisionOutcome) => {
    if (!candidateId) return;
    if (outcome === decision.outcome) return; // no-op
    upsert.mutate({
      decisionId: decision.id,
      meetingId,
      candidateId,
      outcome,
    });
  };

  return (
    <div className="flex items-center gap-3">
      <span className="fh-label flex items-center gap-1.5">
        <Gavel className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Outcome
      </span>
      <div
        role="radiogroup"
        aria-label="Decision outcome"
        className="flex items-center gap-0.5 border border-hairline rounded-input"
      >
        {options.map((opt) => {
          const active = decision.outcome === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onPick(opt.value)}
              className={`text-sm px-3 py-1.5 transition-colors duration-120 ${
                active
                  ? 'bg-ink text-ink-inverse'
                  : 'text-ink-secondary hover:text-ink'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {pending && (
        <span className="font-mono text-xs text-ink-tertiary">Saving…</span>
      )}
      {/* 409 = a racing click already saved this decision. The meeting
          query refetches in onError so the panel picks up the existing
          row's id; surfacing "Couldn't save" would be misleading because
          the data is, in fact, saved. Hide the error UI for that case. */}
      {upsert.isError &&
        !(upsert.error instanceof ApiError && upsert.error.status === 409) && (
          <span className="text-xs text-accent" role="alert">
            Couldn’t save
          </span>
        )}
    </div>
  );
}
