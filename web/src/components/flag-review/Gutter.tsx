import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { FlagVM } from '../../lib/flagReview';
import type { SeverityKey } from '../../lib/severity';
import { FlagCard } from './FlagCard';

// Ported from the design drop's gutter.jsx. Two modes: Marginalia (cards
// anchored next to their transcript span, top-down overlap resolution via DOM
// measurement) and Queue (severity-tier-ordered list). The mockup's numeric
// `a.id - b.id` sort is replaced with the display `index`, since real flag ids
// are UUIDs.

export type GutterMode = 'marginalia' | 'queue';

interface GutterCallbacks {
  onActivate: (id: string) => void;
  onHover: (id: string | null) => void;
  onDismiss: (id: string, reason: string) => void;
  onUndo: (id: string) => void;
  onApply: (id: string) => void;
}

interface GutterProps extends GutterCallbacks {
  mode: GutterMode;
  flags: FlagVM[];
  activeFlagId: string | null;
  hoveredFlagId: string | null;
  expandedId: string | null;
  dismissedFlagIds: Set<string>;
  dismissReasons: Record<string, string>;
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

function renderCard(flag: FlagVM, props: GutterProps) {
  return (
    <FlagCard
      key={flag.id}
      flag={flag}
      expanded={props.expandedId === flag.id}
      isActive={props.activeFlagId === flag.id}
      isDismissed={props.dismissedFlagIds.has(flag.id)}
      dismissReason={props.dismissReasons[flag.id]}
      onActivate={props.onActivate}
      onHover={props.onHover}
      onDismiss={props.onDismiss}
      onUndo={props.onUndo}
      onApply={props.onApply}
    />
  );
}

// ── Marginalia: anchor each card near its span; push down to resolve overlaps ─
function MarginaliaGutter(props: GutterProps) {
  const { flags, expandedId, dismissedFlagIds } = props;
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
    flags.forEach((f) => {
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
  }, [flags]);

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
    flags.forEach((f) => {
      const spanEl = document.querySelector(`[data-flag-span="${f.id}"]`);
      if (spanEl) obs.observe(spanEl);
    });
    const transcriptRoot = document
      .querySelector(`[data-flag-span="${flags[0]?.id}"]`)
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
  }, [recompute, expandedId, dismissedFlagIds]);

  return (
    <div ref={containerRef} className="relative" style={{ height: `${containerH}px` }}>
      {flags.map((flag) => (
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

// ── Queue: severity-tier-ordered list, dismissed pushed to the bottom ─────────
const SEV_ORDER: Record<SeverityKey, number> = { high: 0, med: 1, low: 2 };

function QueueGutter(props: GutterProps) {
  const { flags, dismissedFlagIds } = props;
  const sorted = [...flags].sort((a, b) => {
    const da = dismissedFlagIds.has(a.id) ? 1 : 0;
    const db = dismissedFlagIds.has(b.id) ? 1 : 0;
    if (da !== db) return da - db;
    if (SEV_ORDER[a.severityKey] !== SEV_ORDER[b.severityKey]) {
      return SEV_ORDER[a.severityKey] - SEV_ORDER[b.severityKey];
    }
    return a.index - b.index;
  });

  const liveCount = (key: SeverityKey) =>
    flags.filter((f) => f.severityKey === key && !dismissedFlagIds.has(f.id)).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-sm pb-3 border-b border-hairline">
        <span className="text-ink font-medium">
          High <span className="text-ink-tertiary font-normal">· {liveCount('high')}</span>
        </span>
        <span className="text-ink font-medium">
          Med <span className="text-ink-tertiary font-normal">· {liveCount('med')}</span>
        </span>
        <span className="text-ink font-medium">
          Low <span className="text-ink-tertiary font-normal">· {liveCount('low')}</span>
        </span>
      </div>
      {sorted.map((flag) => renderCard(flag, props))}
    </div>
  );
}

export function Gutter(props: GutterProps) {
  return props.mode === 'queue' ? <QueueGutter {...props} /> : <MarginaliaGutter {...props} />;
}
