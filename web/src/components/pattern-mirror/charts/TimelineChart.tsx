import type { MirrorDecision } from '../../../lib/mirrorData';

interface TimelineChartProps {
  decisions: MirrorDecision[];
  width?: number;
  height?: number;
  days?: number;
  highlightDays?: number;
}

// Decision velocity over a window — one vertical tick per interview, tick
// height encodes flag count, a dashed 7-day rolling-average line shows trend,
// hired interviews get the accent dot. No gridlines; axis labels at the
// meaningful values only (today / 30 / 60 / 90 days ago, peak flag count).
export function TimelineChart({
  decisions,
  width = 1100,
  height = 160,
  days = 90,
  highlightDays = 30,
}: TimelineChartProps) {
  const margin = { top: 18, right: 20, bottom: 36, left: 20 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const maxFlags = Math.max(6, ...decisions.map((d) => d.flags));
  const tickMaxH = innerH * 0.78;
  const xFor = (daysAgo: number) => ((days - daysAgo) / days) * innerW;

  // Per-day flag totals, then 7-day centred rolling average.
  const perDay = new Array<number>(days + 1).fill(0);
  for (const d of decisions) {
    if (d.daysAgo <= days) perDay[d.daysAgo] += d.flags;
  }
  const rolling = perDay.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - 3); j <= Math.min(days, i + 3); j++) {
      sum += perDay[j];
      n++;
    }
    return sum / n;
  });
  const maxRoll = Math.max(0.001, ...rolling);
  // Format the M/L prefix AFTER reversing so M lands at the path's first
  // command — putting it before reverse left an "L … M" string that SVG
  // rejects (this matches and fixes the bug carried over from the JSX).
  const rollPath = rolling
    .map((v, i) => {
      const x = ((days - i) / days) * innerW;
      const y = innerH - (v / maxRoll) * (innerH * 0.55);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .reverse()
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt}`)
    .join(' ');

  const axisTicks = [0, 30, 60, 90].map((d) => ({ daysAgo: d, x: xFor(d) }));

  return (
    <div className="relative">
      <svg width={width} height={height} className="block">
        {/* 30-day highlight backdrop */}
        <rect
          x={margin.left + xFor(highlightDays)}
          y={margin.top}
          width={innerW - xFor(highlightDays)}
          height={innerH}
          fill="var(--color-surface-sunk)"
          opacity="0.5"
        />
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <line
            x1={0}
            y1={innerH}
            x2={innerW}
            y2={innerH}
            stroke="var(--color-border)"
            strokeWidth="1"
          />
          <path
            d={rollPath}
            fill="none"
            stroke="var(--color-text-tertiary)"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          {decisions.map((d) => {
            const x = xFor(d.daysAgo);
            const h = Math.max(3, (d.flags / maxFlags) * tickMaxH);
            const isHired = d.outcome === 'Hired';
            return (
              <g key={d.id}>
                <line
                  x1={x}
                  y1={innerH}
                  x2={x}
                  y2={innerH - h}
                  stroke="var(--color-text-primary)"
                  strokeWidth="1"
                />
                {isHired && <circle cx={x} cy={innerH - h - 5} r="3" fill="var(--color-accent)" />}
              </g>
            );
          })}
          {axisTicks.map((t) => (
            <line
              key={t.daysAgo}
              x1={t.x}
              y1={innerH}
              x2={t.x}
              y2={innerH + 4}
              stroke="var(--color-border)"
              strokeWidth="1"
            />
          ))}
          <text
            x={xFor(90)}
            y={innerH + 22}
            className="font-mono fill-[var(--color-text-tertiary)]"
            fontSize="12"
          >
            90 days ago
          </text>
          <text
            x={xFor(60)}
            y={innerH + 22}
            textAnchor="middle"
            className="font-mono fill-[var(--color-text-tertiary)]"
            fontSize="12"
          >
            60d
          </text>
          <text
            x={xFor(30)}
            y={innerH + 22}
            textAnchor="middle"
            className="font-mono fill-[var(--color-text-tertiary)]"
            fontSize="12"
          >
            30d
          </text>
          <text
            x={xFor(0)}
            y={innerH + 22}
            textAnchor="end"
            className="font-mono fill-[var(--color-text-tertiary)]"
            fontSize="12"
          >
            Today
          </text>
          <text
            x={0}
            y={innerH - tickMaxH - 4}
            className="font-mono fill-[var(--color-text-tertiary)]"
            fontSize="12"
          >
            {maxFlags} flags
          </text>
          <text
            x={innerW}
            y={innerH - 4}
            textAnchor="end"
            className="font-mono fill-[var(--color-text-tertiary)]"
            fontSize="12"
          >
            1
          </text>
        </g>
      </svg>
      <div className="flex items-center gap-5 mt-2 text-sm text-ink-tertiary">
        <span className="flex items-center gap-2">
          <span className="inline-block w-px h-3 bg-ink" />
          Interview · tick height = flags raised
        </span>
        <span className="flex items-center gap-2">
          <svg width="20" height="8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="20"
              y2="4"
              stroke="var(--color-text-tertiary)"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          </svg>
          7-day rolling average
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-accent" />
          Hired
        </span>
      </div>
    </div>
  );
}
