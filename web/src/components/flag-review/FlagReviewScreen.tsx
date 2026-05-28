import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AnalysisStatus as RunStatus } from '@fairhire/shared';
import type { FlagVM, MeetingVM } from '../../lib/flagReview';
import { useManager } from '../../lib/ManagerContext';
import { InitialsAvatar } from '../shared/primitives';
import { AnalysisStatus } from './AnalysisStatus';
import { Gutter, GutterHeader, type GutterMode } from './Gutter';
import { Transcript } from './Transcript';

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

interface FlagReviewScreenProps {
  meeting: MeetingVM;
  /** re-fetch / re-trigger analysis (used by the failed-state Retry) */
  onRetry: () => void;
}

export function FlagReviewScreen({ meeting, onRetry }: FlagReviewScreenProps) {
  const manager = useManager();
  const { status } = meeting.analysis;
  const flags = meeting.flags;

  const flagsById: Record<string, FlagVM> = {};
  for (const f of flags) flagsById[f.id] = f;

  // Interaction state
  const [activeFlagId, setActiveFlagId] = useState<string | null>(null);
  const [hoveredFlagId, setHoveredFlagId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissedFlagIds, setDismissedFlagIds] = useState<Set<string>>(new Set());
  const [dismissReasons, setDismissReasons] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<GutterMode>('marginalia');

  // Streaming-reveal state
  const [visibleFlagIds, setVisibleFlagIds] = useState<Set<string>>(new Set());
  const [elapsedMs, setElapsedMs] = useState(0);
  const prevStatus = useRef<RunStatus | null>(null);

  // Reveal flags one-by-one over ~2s (cosmetic — the engine writes them at once).
  const startStaggeredReveal = useCallback(() => {
    setVisibleFlagIds(new Set());
    const stagger = flags.length > 0 ? Math.min(2000 / flags.length, 320) : 0;
    const timers = flags.map((f, i) =>
      window.setTimeout(() => {
        setVisibleFlagIds((prev) => {
          const next = new Set(prev);
          next.add(f.id);
          return next;
        });
      }, 200 + i * stagger)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [flags]);

  // Elapsed timer while analysing.
  useEffect(() => {
    if (status !== 'pending' && status !== 'running') return;
    const start = performance.now();
    const id = window.setInterval(() => setElapsedMs(performance.now() - start), 100);
    return () => window.clearInterval(id);
  }, [status]);

  // On completion: stream if we watched the transition, else show all at once.
  useEffect(() => {
    if (status !== 'completed') {
      prevStatus.current = status;
      return;
    }
    const wasAnalysing = prevStatus.current === 'pending' || prevStatus.current === 'running';
    prevStatus.current = status;
    if (!wasAnalysing) {
      setVisibleFlagIds(new Set(flags.map((f) => f.id)));
      return;
    }
    return startStaggeredReveal();
  }, [status, flags, startStaggeredReveal]);

  const activateFlag = (flagId: string) => {
    setActiveFlagId(flagId);
    setExpandedId(flagId);
    // Wait for the expand-driven layout shift, then scroll the span into view.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const target =
          document.querySelector(`[data-flag-span="${flagId}"]`) ??
          document.querySelector(`[data-flag-card="${flagId}"]`);
        if (!target) return;
        const rect = target.getBoundingClientRect();
        if (rect.top < 100 || rect.bottom > window.innerHeight - 80) {
          window.scrollTo({ top: window.scrollY + rect.top - 140, behavior: 'smooth' });
        }
      })
    );
  };

  const dismissFlag = (flagId: string, reason: string) => {
    setDismissedFlagIds((prev) => new Set(prev).add(flagId));
    setDismissReasons((prev) => ({ ...prev, [flagId]: reason }));
    setActiveFlagId(null);
    setExpandedId(null);
  };

  const undoDismiss = (flagId: string) => {
    setDismissedFlagIds((prev) => {
      const next = new Set(prev);
      next.delete(flagId);
      return next;
    });
    setDismissReasons((prev) => {
      const next = { ...prev };
      delete next[flagId];
      return next;
    });
  };

  const dismissedCount = dismissedFlagIds.size;
  const visibleFlags = flags.filter((f) => visibleFlagIds.has(f.id));
  const noFlags = status === 'completed' && flags.length === 0;

  return (
    <div className="max-w-companion mx-auto">
      <div className="pb-8">
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/"
            className="group flex items-baseline gap-3 text-base text-ink-secondary hover:text-ink transition-colors duration-120"
          >
            <span
              aria-hidden="true"
              className="text-base leading-none transition-transform duration-160 group-hover:-translate-x-0.5"
            >
              ←
            </span>
            <span className="underline decoration-hairline underline-offset-4 group-hover:decoration-ink">
              All candidates
            </span>
          </Link>
          <InitialsAvatar initials={initialsOf(manager.name)} />
        </div>

        <div className="flex items-end justify-between gap-8 mb-8">
          <div className="min-w-0">
            <h1 className="font-serif text-page text-ink leading-tight mb-2">{meeting.candidateName}</h1>
            {meeting.candidateRole && (
              <div className="font-serif italic text-section text-ink-secondary mb-3">
                {meeting.candidateRole}
              </div>
            )}
            <div className="flex items-center gap-3 text-sm text-ink-secondary flex-wrap">
              <span>{meeting.title}</span>
              <span className="text-ink-tertiary">·</span>
              <span>Panel debrief · {meeting.panelDate}</span>
              <span className="text-ink-tertiary">·</span>
              <span>Author: {manager.name}</span>
            </div>
          </div>
          {status === 'completed' && (
            <button
              type="button"
              onClick={() => startStaggeredReveal()}
              className="text-sm text-ink-secondary hover:text-ink hover:border-hairline-strong border border-hairline px-3.5 py-2 rounded-input transition-colors duration-120 whitespace-nowrap"
            >
              ▷ Replay analysis
            </button>
          )}
        </div>

        <AnalysisStatus
          status={status}
          elapsedMs={elapsedMs}
          spansEvaluated={meeting.analysis.spansEvaluated}
          durationLabel={meeting.analysis.durationLabel}
          model={meeting.analysis.model}
          error={meeting.analysis.error}
          totalFlags={flags.length}
          revealedFlags={visibleFlags.length}
          dismissedCount={dismissedCount}
          onRetry={onRetry}
        />
      </div>

      <div className="fh-hairline mb-10" />

      <div className="grid grid-cols-[640px_1fr] gap-16 pb-32">
        {/* Transcript column */}
        <div className="min-w-0">
          <div className="flex items-baseline justify-between mb-5 pb-3 border-b border-hairline">
            <span className="font-serif italic text-base text-ink-secondary">Panel debrief</span>
            <span className="text-sm text-ink-tertiary tabular-nums">{meeting.wordCount} words</span>
          </div>
          <Transcript
            paragraphs={meeting.transcript}
            flagsById={flagsById}
            activeFlagId={activeFlagId}
            hoveredFlagId={hoveredFlagId}
            visibleFlagIds={visibleFlagIds}
            dismissedFlagIds={dismissedFlagIds}
            onActivate={activateFlag}
            onHover={setHoveredFlagId}
          />
        </div>

        {/* Gutter */}
        <div className="min-w-0">
          <GutterHeader
            mode={mode}
            onChangeMode={setMode}
            visibleCount={visibleFlags.length - dismissedCount}
            totalCount={flags.length}
          />
          {noFlags ? (
            <p className="font-serif italic text-base text-ink-tertiary">
              No flags raised. Transcript reads clean.
            </p>
          ) : (
            <Gutter
              mode={mode}
              flags={visibleFlags}
              activeFlagId={activeFlagId}
              hoveredFlagId={hoveredFlagId}
              expandedId={expandedId}
              dismissedFlagIds={dismissedFlagIds}
              dismissReasons={dismissReasons}
              onActivate={activateFlag}
              onHover={setHoveredFlagId}
              onDismiss={dismissFlag}
              onUndo={undoDismiss}
              onApply={(id) => dismissFlag(id, 'Applied')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
