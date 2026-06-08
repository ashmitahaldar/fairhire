import { useUpsertDecision } from '../../lib/decisionsApi';
import type { DecisionOutcome, DecisionVM } from '../../lib/flagReview';

interface DecisionPanelProps {
  meetingId: string;
  candidateId: string | null;
  decision: DecisionVM;
}

const OPTIONS: Array<{ value: DecisionOutcome; label: string }> = [
  { value: 'hired', label: 'Hired' },
  { value: 'in_progress', label: 'Pending' },
  { value: 'rejected', label: 'Declined' },
];

// Compact 3-state outcome control. Clicking a button saves immediately —
// no submit step — so the panel doubles as both display and edit affordance.
// Disabled when there's no primary candidate to attach a decision to
// (defensive: should never happen for a real meeting created via the
// upload form, which requires at least one candidate).
export function DecisionPanel({ meetingId, candidateId, decision }: DecisionPanelProps) {
  const upsert = useUpsertDecision();
  const pending = upsert.isPending;
  const disabled = !candidateId || pending;

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
      <span className="fh-label">Outcome</span>
      <div
        role="radiogroup"
        aria-label="Decision outcome"
        className="flex items-center gap-0.5 border border-hairline rounded-input"
      >
        {OPTIONS.map((opt) => {
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
      {upsert.isError && (
        <span className="text-xs text-accent" role="alert">
          Couldn’t save
        </span>
      )}
    </div>
  );
}
