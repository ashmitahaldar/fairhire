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

// Equality on the position map. Used to short-circuit setPositions
// when a recompute pass produces an unchanged layout (e.g. a
// ResizeObserver firing without an actual size delta). Avoids
// re-render churn.
function samePositions(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
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
  //
  // Card height is read via getBoundingClientRect() (sub-pixel accurate; offset-
  // Height rounds and can lag a frame behind a content change). For a flag
  // whose span isn't currently in the DOM (TipTap mid-update), fall back to
  // the previously-resolved position so the card doesn't snap to 0.
  const recompute = useCallback(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;
    // Touch offsetHeight to force a synchronous layout flush before we
    // start measuring children — otherwise a freshly-expanded card may
    // report its old height on the first read after a re-render.
    void containerEl.offsetHeight;
    const gutterTop = containerEl.getBoundingClientRect().top + window.scrollY;

    const items: { id: string; idealTop: number; h: number }[] = [];
    liveFlags.forEach((f) => {
      const spanEl = document.querySelector(`[data-flag-span="${f.id}"]`);
      const cardEl = cardRefs.current[f.id];
      const cardH = cardEl ? cardEl.getBoundingClientRect().height : 80;
      let idealTop: number | null = null;
      if (spanEl) {
        idealTop = spanEl.getBoundingClientRect().top + window.scrollY - gutterTop;
      } else {
        // Span temporarily missing (e.g. TipTap re-applying decorations) —
        // hold the previously-resolved position so the card stays parked
        // rather than collapsing to 0 and overlapping its siblings.
        const prev = positionsRef.current[f.id];
        if (typeof prev === 'number') idealTop = prev;
      }
      if (idealTop === null) return;
      items.push({ id: f.id, idealTop: Math.max(0, idealTop), h: cardH });
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

    // Skip the state update when nothing changed so we don't churn React
    // through a no-op render every time a ResizeObserver callback fires.
    if (samePositions(positionsRef.current, resolved)) return;
    positionsRef.current = resolved;
    setPositions(resolved);
    setContainerH(Math.max(400, maxBottom + 16));
    if (items.length > 0) setIsMeasured(true);
  }, [liveFlags]);

  // Track the latest resolved positions outside React state so the recompute
  // callback can read them without ballooning its dep list (and without
  // racing the still-pending setPositions schedule).
  const positionsRef = useRef<Record<string, number>>({});

  useLayoutEffect(() => {
    // Three measurement passes catch progressively-later settlings:
    //   * sync — the post-render layout right now (covers most expand cases)
    //   * rAF1 — after the browser's next style/layout pass
    //   * rAF2 — after one more frame, in case TipTap's decoration patch
    //            ran between rAF1 and now
    // fonts.ready and the ResizeObserver-driven path catch anything later.
    recompute();
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
      {liveFlags.map((flag) => {
        // Active/expanded card sits above its neighbours so even a
        // brief layout lag during expansion doesn't let a still-shifting
        // sibling visually clip into its body.
        const isExpanded = props.expandedId === flag.id;
        return (
          <div
            key={flag.id}
            ref={(el) => {
              cardRefs.current[flag.id] = el;
            }}
            className="absolute left-0 right-0 top-0 transition-opacity duration-200 ease-quiet"
            style={{
              transform: `translateY(${positions[flag.id] ?? 0}px)`,
              opacity: isMeasured ? 1 : 0,
              zIndex: isExpanded ? 10 : 1,
            }}
          >
            {renderCard(flag, props)}
          </div>
        );
      })}
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
