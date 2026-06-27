import { useEffect, useRef, useState } from 'react';
import type { FlagVM } from '../../lib/flagReview';
import { ChevronDown } from '../shared/primitives';
import { SeverityBadge } from './SeverityBadge';

// Week 5 Step 4 redesign:
//   * Category is the visual hero (serif italic text-body), anchored top.
//     Quote demoted (smaller, no accent left-bar).
//   * Severity badge encodes the tier via visual language, not just text.
//   * "Apply suggestion" removed — the suggestion is prose-only.
//   * Dismiss menu adds "Acknowledged" as the first preset; "Other"
//     expands into an inline freeform input.
//   * Multi-instance flags get a "Found in N places · ‹ k/N ›" footer
//     with arrow nav. Single-instance flags don't show it.

const DISMISS_PRESETS = [
  'Acknowledged',
  'Context I have',
  'Disagree with flag',
  'Already addressed',
];
const OTHER_REASON = 'Other';

interface DismissReasonPickerProps {
  onPick: (reason: string) => void;
  onCancel: () => void;
}

function DismissReasonPicker({ onPick, onCancel }: DismissReasonPickerProps) {
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (otherOpen) inputRef.current?.focus();
  }, [otherOpen]);

  // When the freeform "Other" field is open the picker collapses to
  // [input] Save / Cancel — keeps the reason row at one line and stops
  // the user accidentally clicking a preset while typing a reason.
  if (otherOpen) {
    const trimmed = otherText.trim();
    const canSave = trimmed.length > 0;
    const save = () => {
      if (canSave) onPick(trimmed);
    };
    return (
      <div className="flex items-center gap-2 flex-wrap min-w-0 grow">
        <span className="font-serif italic text-sm text-ink-tertiary mr-1">Reason</span>
        <input
          ref={inputRef}
          type="text"
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setOtherOpen(false);
              setOtherText('');
            }
          }}
          placeholder="Type a reason…"
          aria-label="Dismiss reason"
          className="flex-1 min-w-0 text-sm text-ink bg-transparent border-b border-hairline focus:border-ink-secondary outline-none py-1 placeholder:text-ink-tertiary placeholder:italic"
        />
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="text-xs font-medium text-ink hover:text-accent transition-colors duration-120 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setOtherOpen(false);
            setOtherText('');
          }}
          className="text-xs text-ink-tertiary hover:text-ink-secondary transition-colors duration-120"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="font-serif italic text-sm text-ink-tertiary mr-1">Reason</span>
      {DISMISS_PRESETS.map((r) => (
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
        key={OTHER_REASON}
        type="button"
        onClick={() => setOtherOpen(true)}
        className="text-xs font-medium text-ink-secondary border border-hairline px-2 py-1 rounded-input hover:border-ink-secondary hover:text-ink transition-colors duration-120"
      >
        {OTHER_REASON}
      </button>
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

interface MultiInstanceNavProps {
  current: number;
  total: number;
  onCycle: (delta: 1 | -1) => void;
}

function MultiInstanceNav({ current, total, onCycle }: MultiInstanceNavProps) {
  // 1-based display for humans; the cycle handler operates on the same
  // 1..total range and wraps in the screen-level state.
  return (
    <div className="flex items-center justify-between text-xs text-ink-tertiary">
      <span className="font-serif italic">Found in {total} places</span>
      <span className="flex items-center gap-2 font-mono tabular-nums">
        <button
          type="button"
          aria-label="Previous occurrence"
          onClick={(e) => {
            e.stopPropagation();
            onCycle(-1);
          }}
          className="px-1 hover:text-ink transition-colors duration-120"
        >
          ‹
        </button>
        <span>
          {current} / {total}
        </span>
        <button
          type="button"
          aria-label="Next occurrence"
          onClick={(e) => {
            e.stopPropagation();
            onCycle(1);
          }}
          className="px-1 hover:text-ink transition-colors duration-120"
        >
          ›
        </button>
      </span>
    </div>
  );
}

interface FlagCardProps {
  flag: FlagVM;
  expanded: boolean;
  isActive: boolean;
  isDismissed: boolean;
  dismissReason?: string;
  /** 1-based index of the currently-focused occurrence (multi-instance flags only). */
  currentInstance?: number;
  onActivate: (id: string) => void;
  onHover: (id: string | null) => void;
  onDismiss: (id: string, reason: string) => void;
  onUndo: (id: string) => void;
  onCycleInstance?: (id: string, delta: 1 | -1) => void;
}

export function FlagCard({
  flag,
  expanded,
  isActive,
  isDismissed,
  dismissReason,
  currentInstance,
  onActivate,
  onHover,
  onDismiss,
  onUndo,
  onCycleInstance,
}: FlagCardProps) {
  const [picking, setPicking] = useState(false);

  // Reset the reason picker whenever the card collapses.
  useEffect(() => {
    if (!expanded) setPicking(false);
  }, [expanded]);

  const showInstanceNav = flag.instanceCount > 1 && currentInstance && onCycleInstance;

  // ── Dismissed + collapsed: two-line strip ─────────────────────────────
  // Line 1: category + reason · Undo (right-aligned, fixed)
  // Line 2: truncated quote
  // The strip is clickable to expand into the full card body (so the
  // user can re-read the original quote + reasoning); Undo stops
  // propagation so undoing doesn't first expand the card.
  if (isDismissed && !expanded) {
    return (
      <article
        data-flag-card={flag.id}
        onClick={() => onActivate(flag.id)}
        onMouseEnter={() => onHover(flag.id)}
        onMouseLeave={() => onHover(null)}
        className="bg-surface-sunk border border-hairline rounded-card px-4 py-3 cursor-pointer transition-colors duration-120 hover:border-hairline-strong"
      >
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="min-w-0 flex items-baseline gap-2 truncate">
            <span className="font-serif italic text-sm text-ink-tertiary shrink-0">
              Dismissed
            </span>
            <span className="font-serif italic text-base text-ink-secondary truncate">
              {flag.category}
            </span>
            {dismissReason && (
              <span className="text-sm text-ink-tertiary truncate">· {dismissReason}</span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUndo(flag.id);
            }}
            className="text-xs font-medium text-ink hover:text-accent transition-colors duration-120 whitespace-nowrap shrink-0"
          >
            Undo
          </button>
        </div>
        <p className="font-serif italic text-sm text-ink-tertiary line-through truncate">
          “{flag.span}”
        </p>
      </article>
    );
  }

  // ── Dismissed + expanded: full content, no Dismiss action ───────────
  // Same body as the live expanded card so the original quote and
  // reasoning are visible (no strikethrough on the quote — strikethrough
  // makes it hard to read; the surface tint + footer label carry the
  // "this is dismissed" signal). The bottom row swaps Dismiss for Undo
  // and surfaces the recorded reason.
  if (isDismissed && expanded) {
    return (
      <article
        data-flag-card={flag.id}
        onMouseEnter={() => onHover(flag.id)}
        onMouseLeave={() => onHover(null)}
        className="bg-surface-sunk border border-hairline rounded-card relative p-5"
      >
        <ActiveRule visible={isActive} />

        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="font-serif italic text-section text-ink leading-tight">
            {flag.category}
          </h3>
          <SeverityBadge tier={flag.severityKey} label={flag.severityLabel} score={flag.confidence} />
        </div>

        <blockquote className="font-serif italic text-body text-ink-secondary mb-5 leading-snug">
          “{flag.span}”
        </blockquote>

        <p className="text-sm text-ink-secondary mb-5 leading-relaxed">{flag.reasoning}</p>

        {flag.suggestion && (
          <>
            <div className="fh-hairline mb-5" />
            <div className="font-serif italic text-base text-ink-tertiary mb-2">Suggested</div>
            <p className="font-serif text-body text-ink mb-5 leading-snug">“{flag.suggestion}”</p>
          </>
        )}

        {showInstanceNav && (
          <>
            <div className="fh-hairline mb-3" />
            <div className="mb-4">
              <MultiInstanceNav
                current={currentInstance}
                total={flag.instanceCount}
                onCycle={(d) => onCycleInstance(flag.id, d)}
              />
            </div>
          </>
        )}

        <div className="fh-hairline mb-4" />

        <div className="min-h-[28px] flex items-center justify-between gap-3">
          <span className="font-serif italic text-sm text-ink-tertiary truncate">
            Dismissed{dismissReason ? ` · ${dismissReason}` : ''}
          </span>
          <button
            type="button"
            onClick={() => onUndo(flag.id)}
            className="text-sm font-medium text-ink hover:text-accent transition-colors duration-120 whitespace-nowrap"
          >
            Undo
          </button>
        </div>
      </article>
    );
  }

  // ── Collapsed: category hero, demoted quote, line-clamped reasoning ──
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
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-serif italic text-body text-ink leading-tight">{flag.category}</h3>
          <SeverityBadge tier={flag.severityKey} label={flag.severityLabel} score={flag.confidence} />
        </div>
        <blockquote className="font-serif italic text-sm text-ink-secondary mb-2 leading-snug line-clamp-2">
          “{flag.span}”
        </blockquote>
        <p className="text-xs text-ink-tertiary line-clamp-2 leading-relaxed">{flag.reasoning}</p>
        {showInstanceNav && (
          <div className="mt-3 pt-2 border-t border-hairline">
            <MultiInstanceNav
              current={currentInstance}
              total={flag.instanceCount}
              onCycle={(d) => onCycleInstance(flag.id, d)}
            />
          </div>
        )}
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

      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="font-serif italic text-section text-ink leading-tight">{flag.category}</h3>
        <SeverityBadge tier={flag.severityKey} label={flag.severityLabel} score={flag.confidence} />
      </div>

      <blockquote className="font-serif italic text-body text-ink-secondary mb-5 leading-snug">
        “{flag.span}”
      </blockquote>

      <p className="text-sm text-ink-secondary mb-5 leading-relaxed">{flag.reasoning}</p>

      {/* Suggested alternative — only when the engine produced one. Prose
          only since Week 5: the Apply button is gone. */}
      {flag.suggestion && (
        <>
          <div className="fh-hairline mb-5" />
          <div className="font-serif italic text-base text-ink-tertiary mb-2">Suggested</div>
          <p className="font-serif text-body text-ink mb-5 leading-snug">“{flag.suggestion}”</p>
        </>
      )}

      {showInstanceNav && (
        <>
          <div className="fh-hairline mb-3" />
          <div className="mb-4">
            <MultiInstanceNav
              current={currentInstance}
              total={flag.instanceCount}
              onCycle={(d) => onCycleInstance(flag.id, d)}
            />
          </div>
        </>
      )}

      <div className="fh-hairline mb-4" />

      <div className="min-h-[28px] flex items-center justify-end gap-3">
        {!picking ? (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex items-center gap-1 text-sm text-ink-secondary hover:text-ink transition-colors duration-120"
          >
            Dismiss
            <ChevronDown />
          </button>
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
