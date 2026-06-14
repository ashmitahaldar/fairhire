import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AnalysisStatus as RunStatus } from '@fairhire/shared';
import { MEETING_TYPE_LABELS } from '@fairhire/shared';
import type { FlagVM, MeetingVM } from '../../lib/flagReview';
import { useRerunAnalysis } from '../../lib/useAnalysisRun';
import { useSetFlagDismissed } from '../../lib/flagsApi';
import { DecisionPanel } from './DecisionPanel';
import { useManager } from '../../lib/ManagerContext';
import { InitialsAvatar } from '../shared/primitives';
import { AnalysisStatus } from './AnalysisStatus';
import { Gutter, GutterHeader, type GutterMode } from './Gutter';
import { RerunConfirmModal } from './RerunConfirmModal';
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
}

export function FlagReviewScreen({ meeting }: FlagReviewScreenProps) {
  const manager = useManager();
  const { status } = meeting.analysis;
  const flags = meeting.flags;

  const flagsById: Record<string, FlagVM> = {};
  for (const f of flags) flagsById[f.id] = f;

  // Interaction state
  const [activeFlagId, setActiveFlagId] = useState<string | null>(null);
  const [hoveredFlagId, setHoveredFlagId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mode, setMode] = useState<GutterMode>('marginalia');

  // Dismissed state. Derived from the server-supplied meeting.flags
  // (which carry Flag.dismissed + dismissReason) so a reload still
  // shows what was dismissed; local optimistic overrides layer on top
  // so a click takes effect immediately and survives the PATCH +
  // refetch round-trip.
  const setFlagDismissed = useSetFlagDismissed(meeting.id);
  const [optimisticDismiss, setOptimisticDismiss] = useState<
    Record<string, { dismissed: boolean; reason: string | null }>
  >({});
  const dismissedFlagIds = new Set<string>();
  const dismissReasons: Record<string, string> = {};
  for (const f of flags) {
    const o = optimisticDismiss[f.id];
    const dismissed = o ? o.dismissed : f.dismissed;
    const reason = o ? o.reason : f.dismissReason;
    if (dismissed) {
      dismissedFlagIds.add(f.id);
      if (reason) dismissReasons[f.id] = reason;
    }
  }
  // Drop optimistic overrides once the server-truth catches up (the
  // refetch after a successful PATCH) so we don't keep stale entries
  // around forever.
  useEffect(() => {
    setOptimisticDismiss((prev) => {
      const next: typeof prev = {};
      for (const [id, o] of Object.entries(prev)) {
        const f = flags.find((x) => x.id === id);
        if (!f) continue; // flag is gone (e.g. after re-run); drop
        if (f.dismissed === o.dismissed) continue; // server caught up; drop
        next[id] = o;
      }
      return next;
    });
  }, [flags]);

  // Multi-instance navigation: which occurrence of each flag is the
  // current scroll target. 1-based to match the UI labelling
  // ("1 of 3"); flags without an entry default to 1.
  const [activeInstanceByFlag, setActiveInstanceByFlag] = useState<Record<string, number>>({});

  // Re-run analysis. The confirm-and-discard modal is shown only when
  // the user has at least one dismissal staged (a re-run wipes them,
  // there's no Flag.runId this week). The hook handles the request +
  // refetch invalidation; we just decide whether to gate.
  const rerun = useRerunAnalysis(meeting.id);
  const [rerunModalOpen, setRerunModalOpen] = useState(false);

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

  // Scroll the (instance-targeted) span into view if it's off-screen.
  // Shared between activateFlag and cycleInstance so both code paths
  // use the same vertical alignment heuristic.
  const scrollSpanIntoView = (flagId: string, instance1Based: number) => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const spans = document.querySelectorAll<HTMLElement>(`[data-flag-span="${flagId}"]`);
        const target =
          spans[Math.max(0, instance1Based - 1)] ??
          spans[0] ??
          document.querySelector<HTMLElement>(`[data-flag-card="${flagId}"]`);
        if (!target) return;
        const rect = target.getBoundingClientRect();
        if (rect.top < 100 || rect.bottom > window.innerHeight - 80) {
          window.scrollTo({ top: window.scrollY + rect.top - 140, behavior: 'smooth' });
        }
      }),
    );
  };

  const activateFlag = useCallback(
    (flagId: string) => {
      setActiveFlagId(flagId);
      setExpandedId(flagId);
      // Default to the first occurrence on activate; cycleInstance bumps
      // it from there.
      setActiveInstanceByFlag((prev) => ({ ...prev, [flagId]: prev[flagId] ?? 1 }));
      scrollSpanIntoView(flagId, activeInstanceByFlag[flagId] ?? 1);
      // Keep the URL shareable — every activate updates ?flag=<id>
      // without pushing a new history entry. replaceState is silent
      // wrt react-router so it doesn't trigger a re-render loop.
      const url = new URL(window.location.href);
      if (url.searchParams.get('flag') !== flagId) {
        url.searchParams.set('flag', flagId);
        window.history.replaceState({}, '', url.toString());
      }
    },
    [activeInstanceByFlag],
  );

  // Arrow nav on a multi-instance flag's card. Wraps in both directions
  // so the user can keep clicking ‹ or › without dead-end behaviour.
  const cycleInstance = (flagId: string, delta: 1 | -1) => {
    const flag = flagsById[flagId];
    if (!flag || flag.instanceCount <= 1) return;
    setActiveInstanceByFlag((prev) => {
      const cur = prev[flagId] ?? 1;
      // Modulo-wrap on a 1-based range: subtract 1 → wrap → add 1 back.
      const next = ((cur - 1 + delta + flag.instanceCount) % flag.instanceCount) + 1;
      // Schedule the scroll for after the state update has applied.
      requestAnimationFrame(() => scrollSpanIntoView(flagId, next));
      return { ...prev, [flagId]: next };
    });
  };

  const dismissFlag = (flagId: string, reason: string) => {
    // Optimistic: drop the override the moment the click happens so the
    // card moves to the dismissed footer without waiting for the round-
    // trip. The useEffect above clears the override once the server-
    // truth catches up via the meeting-query refetch.
    setOptimisticDismiss((prev) => ({
      ...prev,
      [flagId]: { dismissed: true, reason },
    }));
    setActiveFlagId(null);
    setExpandedId(null);
    setFlagDismissed.mutate({ flagId, dismissed: true, dismissReason: reason });
  };

  // Re-run flow. Open the gate modal if anything's been dismissed,
  // otherwise fire the mutation immediately. The failed-state Retry
  // shares this entry point so both paths go through the same gate.
  const requestRerun = useCallback(() => {
    if (dismissedFlagIds.size > 0) {
      setRerunModalOpen(true);
      return;
    }
    rerun.mutate();
  }, [dismissedFlagIds, rerun]);

  const confirmRerun = useCallback(() => {
    rerun.mutate(undefined, {
      onSuccess: () => {
        // The server discarded the dismissed flag rows; clear any
        // optimistic overrides so we don't hold ghost ids after the
        // refetch returns the fresh flag set.
        setOptimisticDismiss({});
        setActiveFlagId(null);
        setExpandedId(null);
        setRerunModalOpen(false);
      },
    });
  }, [rerun]);

  const undoDismiss = (flagId: string) => {
    setOptimisticDismiss((prev) => ({
      ...prev,
      [flagId]: { dismissed: false, reason: null },
    }));
    setFlagDismissed.mutate({ flagId, dismissed: false });
  };

  // ?flag=<id> deep-link: on first mount (and once per meeting load),
  // activate the requested flag if it exists. Uses a ref so a fresh
  // user click can't be overridden by a re-run of this effect; the
  // ref resets per meeting so opening a different meeting honours its
  // own ?flag= param.
  const deepLinkDoneFor = useRef<string | null>(null);
  useEffect(() => {
    if (deepLinkDoneFor.current === meeting.id) return;
    if (flags.length === 0) return; // wait for analysis to populate
    const target = new URLSearchParams(window.location.search).get('flag');
    if (!target) {
      deepLinkDoneFor.current = meeting.id;
      return;
    }
    if (flagsById[target]) {
      activateFlag(target);
    }
    // Either way, the deep-link has been processed for this meeting.
    deepLinkDoneFor.current = meeting.id;
  }, [meeting.id, flags.length, flagsById, activateFlag]);

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
              All meetings
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
              {/* Mode badge — quiet hairline chip so the reader can
                  tell a promotion debrief apart from a hiring one
                  without leaving the page. */}
              <span className="font-mono text-xs uppercase tracking-meta text-ink-secondary border border-hairline rounded-input px-2 py-0.5">
                {MEETING_TYPE_LABELS[meeting.meetingType]}
              </span>
              <span>{meeting.title}</span>
              <span className="text-ink-tertiary">·</span>
              <span>Panel debrief · {meeting.panelDate}</span>
              <span className="text-ink-tertiary">·</span>
              <span>Author: {manager.name}</span>
            </div>
          </div>
          {status === 'completed' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => startStaggeredReveal()}
                className="text-sm text-ink-secondary hover:text-ink hover:border-hairline-strong border border-hairline px-3.5 py-2 rounded-input transition-colors duration-120 whitespace-nowrap"
              >
                ▷ Replay
              </button>
              <button
                type="button"
                onClick={requestRerun}
                disabled={rerun.isPending}
                className="text-sm text-ink-secondary hover:text-ink hover:border-hairline-strong border border-hairline px-3.5 py-2 rounded-input transition-colors duration-120 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {rerun.isPending ? 'Re-running…' : '↻ Re-run analysis'}
              </button>
            </div>
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
          onRetry={requestRerun}
        />

        <div className="mt-6">
          <DecisionPanel
            meetingId={meeting.id}
            meetingType={meeting.meetingType}
            candidateId={meeting.candidateId}
            decision={meeting.decision}
          />
        </div>
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
            transcriptText={meeting.transcriptText}
            flagSpans={meeting.flagSpans}
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
              activeInstanceByFlag={activeInstanceByFlag}
              onActivate={activateFlag}
              onHover={setHoveredFlagId}
              onDismiss={dismissFlag}
              onUndo={undoDismiss}
              onCycleInstance={cycleInstance}
            />
          )}
        </div>
      </div>

      <RerunConfirmModal
        open={rerunModalOpen}
        dismissedCount={dismissedCount}
        isPending={rerun.isPending}
        onConfirm={confirmRerun}
        onCancel={() => setRerunModalOpen(false)}
      />
    </div>
  );
}
