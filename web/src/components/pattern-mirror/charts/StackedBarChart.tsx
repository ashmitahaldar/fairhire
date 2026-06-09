import type { PipelineRow, RaceSegmentKey } from '../../../lib/mirrorData';
import { RACE_SEGMENT_KEYS } from '../../../lib/mirrorData';

interface StackedBarChartProps {
  data: PipelineRow[];
  totalLabel?: string;
}

// Canonical iteration order + display metadata for the 5 race segments.
// Co-located with the chart because they're purely presentation concerns
// — the data model just carries counts keyed by RaceSegmentKey.
const SEGMENTS: Array<{
  key: RaceSegmentKey;
  label: string;
  bg: string;
  text: 'light' | 'dark';
}> = [
  { key: 'chinese', label: 'Chinese', bg: 'var(--color-segment-chinese)', text: 'light' },
  { key: 'malay',   label: 'Malay',   bg: 'var(--color-segment-malay)',   text: 'light' },
  { key: 'indian',  label: 'Indian',  bg: 'var(--color-segment-indian)',  text: 'light' },
  { key: 'other',   label: 'Other',   bg: 'var(--color-segment-other)',   text: 'light' },
  { key: 'unknown', label: 'Unknown', bg: 'var(--color-segment-unknown)', text: 'dark'  },
];

// Hide the in-bar percentage label below this width — narrow segments
// can't fit "12%" without overflowing or clipping. The legend below the
// chart still attributes every colour, so no information is lost.
const MIN_LABEL_PCT = 10;

// Horizontal stacked bar where every row fills the full track — the bar
// encodes composition only, not absolute volume. The drop-off in absolute
// numbers down the funnel is shown by the right-hand total column.
export function StackedBarChart({ data, totalLabel = 'Total' }: StackedBarChartProps) {
  return (
    <div className="space-y-3">
      {data.map((row) => (
        <div
          key={row.stage}
          className="grid grid-cols-[140px_1fr_72px] gap-4 items-center"
        >
          <div className="text-base text-ink">{row.stage}</div>
          <div className="relative h-8 flex">
            {row.total === 0 ? (
              <div className="h-full w-full bg-surface-sunk" aria-hidden="true" />
            ) : (
              SEGMENTS.map((seg) => {
                const count = row.segments[seg.key] ?? 0;
                if (count === 0) return null;
                const pct = (count / row.total) * 100;
                const textColor =
                  seg.text === 'dark' ? 'var(--color-text-primary)' : 'var(--color-text-inverse)';
                return (
                  <div
                    key={seg.key}
                    className="h-full flex items-center pl-2.5 overflow-hidden"
                    style={{ width: `${pct}%`, background: seg.bg }}
                    title={`${seg.label}: ${count} (${pct.toFixed(0)}%)`}
                  >
                    {pct >= MIN_LABEL_PCT && (
                      <span
                        className="font-mono text-xs tabular-nums"
                        style={{ color: textColor }}
                      >
                        {pct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div className="font-mono text-sm text-ink-secondary tabular-nums text-right">
            {row.total.toLocaleString()}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[140px_1fr_72px] gap-4 items-start pt-4 mt-2 border-t border-hairline">
        <span className="text-sm text-ink-tertiary">{totalLabel}</span>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-secondary">
          {SEGMENTS.map((seg) => (
            <span key={seg.key} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3"
                style={{ background: seg.bg }}
                aria-hidden="true"
              />
              {seg.label}
            </span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}

// Re-export so ConversionGrid can derive its binary view (Chinese vs
// non-Chinese) from the same canonical key list and stay consistent if
// the segment set ever changes.
export { RACE_SEGMENT_KEYS };
