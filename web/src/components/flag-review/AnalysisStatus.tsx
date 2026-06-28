import type { CSSProperties } from 'react';
import type { AnalysisStatus as RunStatus } from '@fairhire/shared';

// Hairline progress + honest mono counter, ported from app.jsx's AnalysisStatus.
// Adds a failed variant (error + Retry) the mockup didn't cover. There's no real
// backend progress signal, so the bar creeps toward 95% on elapsed time while
// analysing and snaps to 100% (faded) once terminal.

interface AnalysisStatusProps {
  status: RunStatus;
  elapsedMs: number;
  spansEvaluated: number | null;
  durationLabel: string | null;
  model: string | null;
  error: string | null;
  totalFlags: number;
  revealedFlags: number;
  dismissedCount: number;
  onRetry: () => void;
}

export function AnalysisStatus({
  status,
  elapsedMs,
  spansEvaluated,
  durationLabel,
  model,
  error,
  totalFlags,
  revealedFlags,
  dismissedCount,
  onRetry,
}: AnalysisStatusProps) {
  const analysing = status === 'pending' || status === 'running';
  const failed = status === 'failed';

  const creep = Math.min(0.95, elapsedMs / 8000);
  const progressPct = analysing ? creep * 100 : 100;
  const spansShown =
    spansEvaluated == null ? null : analysing ? Math.floor(spansEvaluated * creep) : spansEvaluated;

  return (
    <div>
      <div className="font-mono text-sm mb-3">
        {analysing && (
          <>
            <span className="text-ink">Analysing transcript</span>
            <span className="text-ink-tertiary"> · </span>
            <span className="text-ink-secondary tabular-nums">{(elapsedMs / 1000).toFixed(1)}s</span>
            {spansShown != null && (
              <>
                <span className="text-ink-tertiary"> · </span>
                <span className="text-ink-secondary tabular-nums">
                  {spansShown.toLocaleString()} spans evaluated
                </span>
              </>
            )}
            <span className="text-ink-tertiary"> · </span>
            <span className="text-ink-secondary tabular-nums">
              {revealedFlags} {revealedFlags === 1 ? 'flag' : 'flags'} found
            </span>
          </>
        )}

        {failed && (
          <>
            <span className="text-ink">Analysis failed</span>
            {error && (
              <>
                <span className="text-ink-tertiary"> · </span>
                <span className="text-ink-secondary">{error}</span>
              </>
            )}
            <span className="text-ink-tertiary"> · </span>
            <button
              type="button"
              onClick={onRetry}
              className="text-ink font-medium hover:text-accent transition-colors duration-120"
            >
              Retry analysis
            </button>
          </>
        )}

        {!analysing && !failed && (
          <>
            <span className="text-ink">Analysed</span>
            {durationLabel && (
              <>
                <span className="text-ink-tertiary"> · </span>
                <span className="text-ink-secondary tabular-nums">{durationLabel}</span>
              </>
            )}
            {spansEvaluated != null && (
              <>
                <span className="text-ink-tertiary"> · </span>
                <span className="text-ink-secondary tabular-nums">
                  {spansEvaluated.toLocaleString()} spans
                </span>
              </>
            )}
            <span className="text-ink-tertiary"> · </span>
            <span className="text-ink-secondary tabular-nums">
              {totalFlags} {totalFlags === 1 ? 'flag' : 'flags'}
            </span>
            {dismissedCount > 0 && (
              <>
                <span className="text-ink-tertiary"> · </span>
                <span className="text-ink-secondary tabular-nums">{dismissedCount} dismissed</span>
              </>
            )}
            {model && (
              <>
                <span className="text-ink-tertiary"> · </span>
                <span className="text-ink-tertiary">model {model}</span>
              </>
            )}
          </>
        )}
      </div>
      <div
        className="fh-progress"
        style={{ '--progress': `${progressPct}%`, opacity: analysing ? 1 : 0.35 } as CSSProperties}
      />
      {analysing && (
        // Wait-state guidance per Section 4 of the Week 5 plan. The user can
        // navigate away and come back; the meeting query resumes polling on
        // remount via TanStack's cache. Past ~90s a run is taking unusually
        // long — reassure rather than leave the spinner looking stuck.
        <p className="font-serif italic text-sm text-ink-tertiary mt-3">
          {elapsedMs > 90_000
            ? "This is taking longer than usual — still working. It's safe to leave this page."
            : "Safe to leave this page — we'll keep analysing in the background."}
        </p>
      )}
      {!analysing && !failed && error && (
        // A completed-but-degraded run carries a note in `error` (the LLM was
        // unavailable, so the result is rules-only). Surface it quietly — the
        // completed line above otherwise looks identical to a clean run.
        <p className="font-serif italic text-sm text-ink-tertiary mt-3">
          Rules-only result — the language model was unavailable for this analysis.
        </p>
      )}
    </div>
  );
}
