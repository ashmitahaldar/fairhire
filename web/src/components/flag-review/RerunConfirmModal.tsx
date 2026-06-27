import { useEffect, useRef } from 'react';

interface RerunConfirmModalProps {
  open: boolean;
  dismissedCount: number;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Confirm-and-discard modal for re-running analysis. Shown only when
// the user has dismissed at least one flag — there's no Flag.runId
// this week, so a re-run wipes the existing flag rows (and the
// manager's dismissal choices with them). The modal is the explicit
// surface for that data loss.
//
// Plain DOM dialog (no portal, no transition) to stay consistent
// with the rest of the design system's editorial restraint.
export function RerunConfirmModal({
  open,
  dismissedCount,
  isPending,
  onConfirm,
  onCancel,
}: RerunConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  // Focus the destructive action on open so Escape / Enter both have
  // meaningful default behaviour. Escape is wired below; Enter on the
  // already-focused button triggers confirm.
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const noun = dismissedCount === 1 ? 'dismissal' : 'dismissals';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rerun-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fh-card bg-surface p-6 w-[440px] max-w-[calc(100%-2rem)]"
      >
        <h2
          id="rerun-modal-title"
          className="font-serif italic text-section text-ink leading-tight mb-3"
        >
          Re-run analysis?
        </h2>
        <p className="text-sm text-ink-secondary mb-5 leading-relaxed">
          The transcript will be re-analysed from scratch. Your{' '}
          <span className="text-ink font-medium">
            {dismissedCount} {noun}
          </span>{' '}
          will be discarded along with the current flag set.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="text-sm text-ink-secondary hover:text-ink transition-colors duration-120 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="text-sm font-medium text-ink-inverse bg-accent px-3 py-1.5 rounded-input hover:opacity-90 transition-opacity duration-120 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? 'Re-running…' : 'Discard & re-run'}
          </button>
        </div>
      </div>
    </div>
  );
}
