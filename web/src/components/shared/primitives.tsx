import { useId, useState, type CSSProperties, type ReactNode } from 'react';

// Shared design-system primitives, ported from the design drop's components.jsx
// (Object.assign(window,…) globals → named ES exports). Only the primitives the
// flag-review screen uses are ported; add others here as screens need them.

interface ConfidenceIndicatorProps {
  level: string;
  score: number;
}

// Confidence: word + 2-decimal score + thin proportional fill bar. No semantic
// colour anywhere — primary ink only, per the design system.
export function ConfidenceIndicator({ level, score }: ConfidenceIndicatorProps) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex flex-col items-end gap-1 select-none">
      <div className="flex items-baseline gap-1 font-mono leading-none">
        <span className="text-sm text-ink font-medium">{level}</span>
        <span className="text-ink-tertiary">·</span>
        <span className="text-xs text-ink tabular-nums">{score.toFixed(2)}</span>
      </div>
      <span className="fh-fillbar" style={{ '--fill': `${pct}%` } as CSSProperties} />
    </div>
  );
}

interface IconProps {
  size?: number;
  className?: string;
}

export function ChevronDown({ size = 12, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className}>
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="square" />
    </svg>
  );
}

export function InitialsAvatar({ initials }: { initials: string }) {
  return (
    <div className="w-7 h-7 rounded-card border border-hairline flex items-center justify-center bg-surface">
      <span className="font-mono text-meta tracking-meta text-ink-secondary">{initials}</span>
    </div>
  );
}

// ── Skeleton loaders ─────────────────────────────────────────────────────────
// Quiet shimmer placeholders so fetches don't pop content in (and so the layout
// doesn't jump). The shimmer freezes under prefers-reduced-motion via the global
// rule in globals.css. Always aria-hidden — the surrounding region carries the
// role="status" + sr-only "Loading…" cue for screen readers.

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`fh-skeleton block ${className}`} />;
}

// Approximate table placeholder — column widths echo the real tables (date,
// name, wide title, trailing count) closely enough to read as "a table is
// loading" without pretending to be pixel-exact.
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="border-t border-hairline">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3.5 border-b border-hairline">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-10" />
        </div>
      ))}
    </div>
  );
}

// Horizontal-bar placeholder for the chart surfaces (Mirror / HR). Descending
// widths suggest a ranked distribution.
export function ChartSkeleton({ rows = 6 }: { rows?: number }) {
  const widths = ['w-3/4', 'w-2/3', 'w-1/2', 'w-2/5', 'w-1/3', 'w-1/4'];
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-3 w-32 shrink-0" />
          <Skeleton className={`h-3 ${widths[i % widths.length]}`} />
        </div>
      ))}
    </div>
  );
}

// ── InfoPopover ──────────────────────────────────────────────────────────────
// Keyboard- and touch-accessible replacement for hover-only `title=` tooltips.
// The trigger (children) is a real button: opens on hover/focus, pins on click,
// closes on blur/Escape. Content is announced to screen readers via
// aria-describedby. stopPropagation on click so a popover inside a clickable
// card (e.g. a flag card) doesn't also toggle the card.
export function InfoPopover({
  label,
  content,
  children,
  triggerClassName = '',
  align = 'left',
}: {
  label: string;
  content: ReactNode;
  children: ReactNode;
  triggerClassName?: string;
  align?: 'left' | 'right';
}) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const panelId = useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? panelId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setPinned((p) => !p);
        }}
        onFocus={() => setHovered(true)}
        onBlur={() => {
          setHovered(false);
          setPinned(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setHovered(false);
            setPinned(false);
            e.currentTarget.blur();
          }
        }}
        className={triggerClassName}
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          id={panelId}
          className={`absolute top-full mt-1.5 z-30 w-64 fh-card shadow-float p-3 font-sans text-sm normal-case tracking-normal text-left text-ink-secondary leading-relaxed ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
