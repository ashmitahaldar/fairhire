import type { LanguageFlagRow } from '../../../lib/mirrorData';

interface LollipopChartProps {
  data: LanguageFlagRow[];
  highlightId?: string;
  labelWidth?: number;
}

// Horizontal lollipop ranking — sorted by count descending. A single row can
// be promoted to the accent colour via highlightId (used to tie a row to the
// active language nudge). Delta column reads as "↑n" or "↓n" vs prior period.
export function LollipopChart({ data, highlightId, labelWidth = 220 }: LollipopChartProps) {
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...sorted.map((d) => d.count));

  return (
    <div className="space-y-2.5">
      {sorted.map((row) => {
        const widthPct = (row.count / maxCount) * 100;
        const isHi = row.id === highlightId || row.highlight;
        const color = isHi ? 'var(--color-accent)' : 'var(--color-text-primary)';
        return (
          <div
            key={row.id}
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: `${labelWidth}px 1fr 84px` }}
          >
            <div className="text-base text-ink truncate">{row.label}</div>
            <div className="relative h-3">
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-hairline" />
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-px"
                style={{ width: `${widthPct}%`, background: color }}
              />
              <span
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: `${widthPct}%`,
                  top: '50%',
                  width: '8px',
                  height: '8px',
                  background: color,
                }}
              />
            </div>
            <div className="font-mono text-sm tabular-nums text-right text-ink flex items-baseline justify-end gap-1.5">
              <span>{row.count}</span>
              {row.delta === null ? (
                // Sparse prior window — delta isn't meaningful. Neutral
                // pip stands in for the arrow so the column stays aligned
                // and the row still reads as "delta-aware".
                <span className="text-xs text-ink-tertiary" title="Not enough prior data">·</span>
              ) : row.delta !== 0 ? (
                <span className="text-xs text-ink-tertiary">
                  {row.delta > 0 ? '↑' : '↓'}
                  {Math.abs(row.delta)}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
