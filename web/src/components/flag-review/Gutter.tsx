import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { FlagVM } from '../../lib/flagReview';
import type { SeverityKey } from '../../lib/severity';
import { FlagCard } from './FlagCard';
import { ChevronDown } from '../shared/primitives';

// Two modes — Marginalia (cards anchored next to their transcript
// span, top-down overlap resolution via DOM measurement) and Queue
// (severity-tier-ordered list). In Week 5 dismissed cards are pulled
// out of both layouts and grouped into a collapsed footer at the
// bottom of the gutter — see DismissedFooter.

export type GutterMode = 'marginalia' | 'queue';

interface GutterCallbacks {
  onActivate: (id: string) => void;
  onHover: (id: string | null) => void;
  onDismiss: (id: string, reason: string) => void;
  onUndo: (id: string) => void;
  onCycleInstance: (id: string, delta: 1 | -1) => void;
}

interface GutterProps extends GutterCallbacks {
  mode: GutterMode;
  flags: FlagVM[];
  activeFlagId: string | null;
  hoveredFlagId: string | null;
  expandedId: string | null;
  dismissedFlagIds: Set<string>;
  dismissReasons: Record<string, string>;
  activeInstanceByFlag: Record<string, number>;
}

interface GutterHeaderProps {
  mode: GutterMode;
  onChangeMode: (mode: GutterMode) => void;
  visibleCount: number;
  totalCount: number;
}

export function GutterHeader({ mode, onChangeMode, visibleCount, totalCount }: GutterHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5 pb-3 border-b border-hairline">
      <div className="flex items-baseline gap-2">
        <span className="font-serif italic text-base text-ink-secondary">Flags</span>
        <span className="font-mono text-sm text-ink-tertiary tabular-nums">
          {visibleCount}/{totalCount}
        </span>
      </div>
      <div className="flex items-center text-sm">
        <button
          type="button"
          onClick={() => onChangeMode('marginalia')}
          className={`px-2 py-1 transition-colors duration-120 ${
            mode === 'marginalia' ? 'text-ink font-medium' : 'text-ink-tertiary hover:text-ink-secondary'
          }`}
        >
          Marginalia
        </button>
        <span className="text-ink-tertiary">·</span>
        <button
          type="button"
          onClick={() => onChangeMode('queue')}
          className={`px-2 py-1 transition-colors duration-120 ${
            mode === 'queue' ? 'text-ink font-medium' : 'text-ink-tertiary hover:text-ink-secondary'
          }`}
        >
          Queue
        </button>
      </div>
    </div>
  );
}

// Per-flag card props derived from the gutter-wide state. Pulled out
// so the marginalia/queue/dismissed renderers stay one-liners.
function cardPropsFor(flag: FlagVM, props: GutterProps) {
  return {
    flag,
    expanded: props.expandedId === flag.id,
    isActive: props.activeFlagId === flag.id,
    isDismissed: props.dismissedFlagIds.has(flag.id),
    dismissReason: props.dismissReasons[flag.id],
    currentInstance: props.activeInstanceByFlag[flag.id] ?? 1,
    onActivate: props.onActivate,
    onHover: props.onHover,
    onDismiss: props.onDismiss,
    onUndo: props.onUndo,
    onCycleInstance: props.onCycleInstance,
  } as const;
}

function renderCard(flag: FlagVM, props: GutterProps) {
  return <FlagCard key={flag.id} {...cardPropsFor(flag, props)} />;
}

// ── Marginalia: anchor each card near its span; push down to resolve overlaps ─
function MarginaliaGutter({ liveFlags, props }: { liveFlags: FlagVM[]; props: GutterProps }) {
  const { expandedId, dismissedFlagIds } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [containerH, setContainerH] = useState(800);
  const [isMeasured, setIsMeasured] = useState(false);

  // Measure each span's top relative to the inner container, then lay cards out
  // top-down: each sits at max(idealTop, previousCard.bottom + 16).
  const recompute = useCallback(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;
    const gutterTop = containerEl.getBoundingClientRect().top + window.scrollY;

    const items: { id: string; idealTop: number; h: number }[] = [];
    liveFlags.forEach((f) => {
      const spanEl = document.querySelector(`[data-flag-span="${f.id}"]`);
      if (!spanEl) return;
      const cardEl = cardRefs.current[f.id];
      const spanTop = spanEl.getBoundingClientRect().top + window.scrollY - gutterTop;
      const cardH = cardEl ? cardEl.offsetHeight : 80;
      items.push({ id: f.id, idealTop: Math.max(0, spanTop), h: cardH });
    });

    items.sort((a, b) => a.idealTop - b.idealTop);
    let runningBottom = -16;
    let maxBottom = 0;
    const resolved: Record<string, number> = {};
    items.forEach((c) => {
      const top = Math.max(c.idealTop, runningBottom + 16);
      resolved[c.id] = top;
      runningBottom = top + c.h;
      maxBottom = Math.max(maxBottom, runningBottom);
    });
    setPositions(resolved);
    setContainerH(Math.max(400, maxBottom + 16));
    if (items.length > 0) setIsMeasured(true);
  }, [liveFlags]);

  useLayoutEffect(() => {
    // rAF + double rAF + fonts.ready catches the paint milestones where span
    // positions are still settling (font swap is the big one).
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      recompute();
      raf2 = requestAnimationFrame(() => recompute());
    });
    if (document.fonts?.ready) void document.fonts.ready.then(() => recompute());

    const obs = new ResizeObserver(() => recompute());
    Object.values(cardRefs.current).forEach((el) => {
      if (el) obs.observe(el);
    });
    liveFlags.forEach((f) => {
      const spanEl = document.querySelector(`[data-flag-span="${f.id}"]`);
      if (spanEl) obs.observe(spanEl);
    });
    const transcriptRoot = document
      .querySelector(`[data-flag-span="${liveFlags[0]?.id}"]`)
      ?.closest('p')?.parentElement;
    if (transcriptRoot) obs.observe(transcriptRoot);
    obs.observe(document.body);

    window.addEventListener('resize', recompute);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      obs.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [recompute, expandedId, dismissedFlagIds, liveFlags]);

  return (
    <div ref={containerRef} className="relative" style={{ height: `${containerH}px` }}>
      {liveFlags.map((flag) => (
        <div
          key={flag.id}
          ref={(el) => {
            cardRefs.current[flag.id] = el;
          }}
          className="absolute left-0 right-0 top-0 transition-[transform,opacity] duration-200 ease-quiet will-change-transform"
          style={{ transform: `translateY(${positions[flag.id] ?? 0}px)`, opacity: isMeasured ? 1 : 0 }}
        >
          {renderCard(flag, props)}
        </div>
      ))}
    </div>
  );
}

// ── Queue: severity-tier-ordered list of live flags ──────────────────────────
const SEV_ORDER: Record<SeverityKey, number> = { high: 0, med: 1, low: 2 };

function QueueGutter({ liveFlags, props }: { liveFlags: FlagVM[]; props: GutterProps }) {
  const sorted = [...liveFlags].sort((a, b) => {
    if (SEV_ORDER[a.severityKey] !== SEV_ORDER[b.severityKey]) {
      return SEV_ORDER[a.severityKey] - SEV_ORDER[b.severityKey];
    }
    return a.index - b.index;
  });

  const tierCount = (key: SeverityKey) => liveFlags.filter((f) => f.severityKey === key).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-sm pb-3 border-b border-hairline">
        <span className="text-ink font-medium">
          High <span className="text-ink-tertiary font-normal">· {tierCount('high')}</span>
        </span>
        <span className="text-ink font-medium">
          Med <span className="text-ink-tertiary font-normal">· {tierCount('med')}</span>
        </span>
        <span className="text-ink font-medium">
          Low <span className="text-ink-tertiary font-normal">· {tierCount('low')}</span>
        </span>
      </div>
      {sorted.map((flag) => renderCard(flag, props))}
    </div>
  );
}

// ── Dismissed footer: collapsed by default, click to expand inline ───────────
function DismissedFooter({
  dismissedFlags,
  props,
}: {
  dismissedFlags: FlagVM[];
  props: GutterProps;
}) {
  const [open, setOpen] = useState(false);
  if (dismissedFlags.length === 0) return null;

  return (
    <div className="mt-8 pt-4 border-t border-hairline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between text-sm text-ink-secondary hover:text-ink transition-colors duration-120 py-2"
      >
        <span className="font-serif italic">
          {dismissedFlags.length} dismissed
        </span>
        <span
          className={`transition-transform duration-120 ${open ? 'rotate-180' : 'rotate-0'}`}
          aria-hidden="true"
        >
          <ChevronDown />
        </span>
      </button>
      {open && (
        <div className="space-y-3 mt-3">
          {dismissedFlags.map((flag) => renderCard(flag, props))}
        </div>
      )}
    </div>
  );
}

export function Gutter(props: GutterProps) {
  // Single source of truth for live vs dismissed partitioning. Both
  // layout modes consume `liveFlags`; the dismissed footer renders
  // independently below.
  const liveFlags = props.flags.filter((f) => !props.dismissedFlagIds.has(f.id));
  const dismissedFlags = props.flags.filter((f) => props.dismissedFlagIds.has(f.id));

  const live =
    props.mode === 'queue' ? (
      <QueueGutter liveFlags={liveFlags} props={props} />
    ) : (
      <MarginaliaGutter liveFlags={liveFlags} props={props} />
    );

  return (
    <>
      {live}
      <DismissedFooter dismissedFlags={dismissedFlags} props={props} />
    </>
  );
}
