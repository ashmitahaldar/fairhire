import type { CSSProperties } from 'react';

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
