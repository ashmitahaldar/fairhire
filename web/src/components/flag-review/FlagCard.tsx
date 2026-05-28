import { useEffect, useState } from 'react';
import type { FlagVM } from '../../lib/flagReview';
import { ConfidenceIndicator, ChevronDown } from '../shared/primitives';

// Ported from the design drop's flag-card.jsx. Three states — collapsed (the
// default in the gutter), expanded (on activate), and a dismissed one-line
// strip with Undo. Dismiss morphs the action row into an inline reason picker.

const DISMISS_REASONS = ['Context I have', 'Disagree with flag', 'Already addressed', 'Other'];

interface DismissReasonPickerProps {
  onPick: (reason: string) => void;
  onCancel: () => void;
}

function DismissReasonPicker({ onPick, onCancel }: DismissReasonPickerProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="font-serif italic text-sm text-ink-tertiary mr-1">Reason</span>
      {DISMISS_REASONS.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onPick(r)}
          className="text-xs font-medium text-ink-secondary border border-hairline px-2 py-1 rounded-input hover:border-ink-secondary hover:text-ink transition-colors duration-120"
        >
          {r}
        </button>
      ))}
      <button
        type="button"
        onClick={onCancel}
        className="ml-1 text-xs text-ink-tertiary hover:text-ink-secondary transition-colors duration-120"
      >
        Cancel
      </button>
    </div>
  );
}

// Subtle 2px oxblood left rule that fades in for the active state.
function ActiveRule({ visible }: { visible: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute left-0 top-0 bottom-0 w-0.5 bg-accent transition-opacity duration-120 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}

interface FlagCardProps {
  flag: FlagVM;
  expanded: boolean;
  isActive: boolean;
  isDismissed: boolean;
  dismissReason?: string;
  onActivate: (id: string) => void;
  onHover: (id: string | null) => void;
  onDismiss: (id: string, reason: string) => void;
  onUndo: (id: string) => void;
  onApply: (id: string) => void;
}

export function FlagCard({
  flag,
  expanded,
  isActive,
  isDismissed,
  dismissReason,
  onActivate,
  onHover,
  onDismiss,
  onUndo,
  onApply,
}: FlagCardProps) {
  const [picking, setPicking] = useState(false);

  // Reset the reason picker whenever the card collapses.
  useEffect(() => {
    if (!expanded) setPicking(false);
  }, [expanded]);

  // ── Dismissed: collapsed one-line strip with Undo ─────────────
  if (isDismissed) {
    return (
      <article
        data-flag-card={flag.id}
        className="bg-surface-sunk border border-hairline rounded-card px-4 py-3 flex items-center justify-between gap-3"
        onMouseEnter={() => onHover(flag.id)}
        onMouseLeave={() => onHover(null)}
      >
        <div className="min-w-0 flex items-center gap-3">
          <span className="font-serif italic text-sm text-ink-tertiary">Dismissed</span>
          <span className="font-serif italic text-base text-ink-secondary line-through truncate">
            “{flag.span}”
          </span>
          {dismissReason && (
            <span className="text-sm text-ink-tertiary whitespace-nowrap">· {dismissReason}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onUndo(flag.id)}
          className="text-xs font-medium text-ink hover:text-accent transition-colors duration-120 whitespace-nowrap"
        >
          Undo
        </button>
      </article>
    );
  }

  // ── Collapsed: category + confidence, hero quote, 2-line reasoning ──
  if (!expanded) {
    return (
      <article
        data-flag-card={flag.id}
        onClick={() => onActivate(flag.id)}
        onMouseEnter={() => onHover(flag.id)}
        onMouseLeave={() => onHover(null)}
        className="fh-card relative p-4 cursor-pointer transition-colors duration-120 hover:border-hairline-strong"
      >
        <ActiveRule visible={isActive} />
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="text-xs font-medium text-ink-secondary">{flag.category}</span>
          <ConfidenceIndicator level={flag.severityLabel} score={flag.confidence} />
        </div>
        <blockquote className="font-serif italic text-body text-accent border-l-2 border-accent pl-3 mb-3 leading-snug">
          “{flag.span}”
        </blockquote>
        <p className="text-xs text-ink-tertiary line-clamp-2 leading-relaxed">{flag.reasoning}</p>
      </article>
    );
  }

  // ── Expanded: full card ──────────────────────────────────────
  return (
    <article
      data-flag-card={flag.id}
      onMouseEnter={() => onHover(flag.id)}
      onMouseLeave={() => onHover(null)}
      className="fh-card relative p-5"
    >
      <ActiveRule visible={isActive} />

      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-sm font-medium text-ink-secondary">{flag.category}</span>
        <ConfidenceIndicator level={flag.severityLabel} score={flag.confidence} />
      </div>

      <blockquote className="font-serif italic text-section text-accent border-l-2 border-accent pl-4 mb-5 leading-snug">
        “{flag.span}”
      </blockquote>

      <p className="text-sm text-ink-secondary mb-5 leading-relaxed">{flag.reasoning}</p>

      {/* Suggested alternative — only when the engine produced one */}
      {flag.suggestion && (
        <>
          <div className="fh-hairline mb-5" />
          <div className="font-serif italic text-base text-ink-tertiary mb-2">Suggested</div>
          <p className="font-serif text-body text-ink mb-5 leading-snug">“{flag.suggestion}”</p>
        </>
      )}

      <div className="fh-hairline mb-4" />

      <div className="min-h-[28px] flex items-center justify-between gap-3">
        {!picking ? (
          <>
            {flag.suggestion ? (
              <button
                type="button"
                onClick={() => onApply(flag.id)}
                className="text-sm font-medium text-ink hover:text-accent transition-colors duration-120"
              >
                Apply suggestion
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex items-center gap-1 text-sm text-ink-secondary hover:text-ink transition-colors duration-120"
            >
              Dismiss
              <ChevronDown />
            </button>
          </>
        ) : (
          <DismissReasonPicker
            onPick={(reason) => {
              setPicking(false);
              onDismiss(flag.id, reason);
            }}
            onCancel={() => setPicking(false)}
          />
        )}
      </div>
    </article>
  );
}
