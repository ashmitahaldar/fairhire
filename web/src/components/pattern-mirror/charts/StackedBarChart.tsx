import type { PipelineRow } from '../../../lib/mirrorData';

interface StackedBarChartProps {
  data: PipelineRow[];
  totalLabel?: string;
}

// Horizontal stacked bar where every row fills the full track — the bar
// encodes composition only, not absolute volume. The drop-off in absolute
// numbers down the funnel is shown by the right-hand total column.
export function StackedBarChart({ data, totalLabel = 'Total' }: StackedBarChartProps) {
  return (
    <div className="space-y-3">
      {data.map((row) => {
        const repPct = (row.represented / row.total) * 100;
        const majPct = (row.majority / row.total) * 100;
        return (
          <div
            key={row.stage}
            className="grid grid-cols-[140px_1fr_72px] gap-4 items-center"
          >
            <div className="text-base text-ink">{row.stage}</div>
            <div className="relative h-8 flex">
              <div
                className="h-full flex items-center pl-2.5"
                style={{ width: `${repPct}%`, background: 'oklch(0.32 0.008 70)' }}
              >
                <span className="font-mono text-xs text-ink-inverse tabular-nums">
                  {repPct.toFixed(0)}%
                </span>
              </div>
              <div
                className="h-full flex items-center pl-2.5"
                style={{ width: `${majPct}%`, background: 'oklch(0.72 0.006 70)' }}
              >
                <span className="font-mono text-xs text-ink tabular-nums">
                  {majPct.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="font-mono text-sm text-ink-secondary tabular-nums text-right">
              {row.total.toLocaleString()}
            </div>
          </div>
        );
      })}
      <div className="grid grid-cols-[140px_1fr_72px] gap-4 items-center pt-4 mt-2 border-t border-hairline">
        <span className="text-sm text-ink-tertiary">{totalLabel}</span>
        <div className="flex items-center gap-5 text-sm text-ink-secondary">
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3"
              style={{ background: 'oklch(0.32 0.008 70)' }}
            />
            Represented background
          </span>
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3"
              style={{ background: 'oklch(0.72 0.006 70)' }}
            />
            Majority
          </span>
        </div>
        <span />
      </div>
    </div>
  );
}
