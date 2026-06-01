/* ─────────────────────────────────────────────────────────────
   Mirror charts — Timeline, StackedBar, Lollipop
   Visual rules (per Section 3.5):
   - No gridlines
   - Axis labels at meaningful values only, mono
   - Bar/line color = primary text color; oxblood only as a
     narrative highlight that ties to a nudge
   - No animated chart entry; render in final state
   ───────────────────────────────────────────────────────────── */

// ── Decision timeline: vertical tick per interview, height = flags ─
function TimelineChart({ decisions, width = 1100, height = 160, days = 90, highlightDays = 30 }) {
  const margin = { top: 18, right: 20, bottom: 36, left: 20 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const maxFlags = Math.max(6, ...decisions.map((d) => d.flags));
  const tickMaxH = innerH * 0.78;
  const xFor = (daysAgo) => ((days - daysAgo) / days) * innerW;

  // Build per-day flag totals, then 7-day rolling average.
  const perDay = new Array(days + 1).fill(0);
  decisions.forEach((d) => {
    if (d.daysAgo <= days) perDay[d.daysAgo] += d.flags;
  });
  const rolling = perDay.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - 3); j <= Math.min(days, i + 3); j++) { sum += perDay[j]; n++; }
    return sum / n;
  });
  const maxRoll = Math.max(0.001, ...rolling);
  const rollPath = rolling
    .map((v, i) => {
      const x = ((days - i) / days) * innerW;
      const y = innerH - (v / maxRoll) * (innerH * 0.55);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .reverse()
    .join(" ");

  // Today, 30d ago, 90d ago axis markers
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
          {/* Baseline */}
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="var(--color-border)" strokeWidth="1" />
          {/* Rolling-avg line */}
          <path d={rollPath} fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeDasharray="2 2" />
          {/* Ticks */}
          {decisions.map((d, i) => {
            const x = xFor(d.daysAgo);
            const h = Math.max(3, (d.flags / maxFlags) * tickMaxH);
            const isHired = d.outcome === "Hired";
            return (
              <g key={i}>
                <line
                  x1={x} y1={innerH}
                  x2={x} y2={innerH - h}
                  stroke="var(--color-text-primary)"
                  strokeWidth="1"
                />
                {isHired && (
                  <circle cx={x} cy={innerH - h - 5} r="3" fill="var(--color-accent)" />
                )}
              </g>
            );
          })}
          {/* Axis ticks at 0/30/60/90 days ago */}
          {axisTicks.map((t, i) => (
            <line
              key={i}
              x1={t.x} y1={innerH}
              x2={t.x} y2={innerH + 4}
              stroke="var(--color-border)"
              strokeWidth="1"
            />
          ))}
          {/* Axis labels */}
          <text x={xFor(90)} y={innerH + 22} className="font-mono fill-[var(--color-text-tertiary)]" fontSize="12">90 days ago</text>
          <text x={xFor(60)} y={innerH + 22} textAnchor="middle" className="font-mono fill-[var(--color-text-tertiary)]" fontSize="12">60d</text>
          <text x={xFor(30)} y={innerH + 22} textAnchor="middle" className="font-mono fill-[var(--color-text-tertiary)]" fontSize="12">30d</text>
          <text x={xFor(0)} y={innerH + 22} textAnchor="end" className="font-mono fill-[var(--color-text-tertiary)]" fontSize="12">Today</text>
          {/* Y reference at maxFlags */}
          <text x={0} y={innerH - tickMaxH - 4} className="font-mono fill-[var(--color-text-tertiary)]" fontSize="12">{maxFlags} flags</text>
          <text x={innerW} y={innerH - 4} textAnchor="end" className="font-mono fill-[var(--color-text-tertiary)]" fontSize="12">1</text>
        </g>
      </svg>
      {/* Inline legend */}
      <div className="flex items-center gap-5 mt-2 text-sm text-ink-tertiary">
        <span className="flex items-center gap-2">
          <span className="inline-block w-px h-3 bg-ink" />
          Interview · tick height = flags raised
        </span>
        <span className="flex items-center gap-2">
          <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeDasharray="2 2" /></svg>
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

// ── Stacked horizontal bar: pipeline composition ──────────────
function StackedBarChart({ data, totalLabel = "Total" }) {
  // Every row fills the full bar track. The drop-off in absolute numbers
  // is shown by the right-side total column; the bar shows composition only.
  return (
    <div className="space-y-3">
      {data.map((row, i) => {
        const repPct = (row.represented / row.total) * 100;
        const majPct = (row.majority / row.total) * 100;
        return (
          <div key={i} className="grid grid-cols-[140px_1fr_72px] gap-4 items-center">
            <div className="text-base text-ink">{row.stage}</div>
            <div className="relative h-8 flex">
              {/* Represented segment (darker tone) */}
              <div
                className="h-full flex items-center pl-2.5"
                style={{ width: `${repPct}%`, background: "oklch(0.32 0.008 70)" }}
              >
                <span className="font-mono text-xs text-ink-inverse tabular-nums">{repPct.toFixed(0)}%</span>
              </div>
              {/* Majority segment (lighter tone) */}
              <div
                className="h-full flex items-center pl-2.5"
                style={{ width: `${majPct}%`, background: "oklch(0.72 0.006 70)" }}
              >
                <span className="font-mono text-xs text-ink tabular-nums">{majPct.toFixed(0)}%</span>
              </div>
            </div>
            <div className="font-mono text-sm text-ink-secondary tabular-nums text-right">{row.total.toLocaleString()}</div>
          </div>
        );
      })}
      {/* Legend */}
      <div className="grid grid-cols-[140px_1fr_72px] gap-4 items-center pt-4 mt-2 border-t border-hairline">
        <span className="text-sm text-ink-tertiary">{totalLabel}</span>
        <div className="flex items-center gap-5 text-sm text-ink-secondary">
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3" style={{ background: "oklch(0.32 0.008 70)" }} />
            Represented background
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3" style={{ background: "oklch(0.72 0.006 70)" }} />
            Majority
          </span>
        </div>
        <span></span>
      </div>
    </div>
  );
}

// ── Horizontal lollipop chart for top language flags ──────────
function LollipopChart({ data, highlightId, labelWidth = 220 }) {
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...sorted.map((d) => d.count));
  return (
    <div className="space-y-2.5">
      {sorted.map((row) => {
        const widthPct = (row.count / maxCount) * 100;
        const isHi = row.id === highlightId || row.highlight;
        const color = isHi ? "var(--color-accent)" : "var(--color-text-primary)";
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
                  top: "50%",
                  width: "8px",
                  height: "8px",
                  background: color,
                }}
              />
            </div>
            <div className="font-mono text-sm tabular-nums text-right text-ink flex items-baseline justify-end gap-1.5">
              <span>{row.count}</span>
              {row.delta !== 0 && (
                <span className="text-xs text-ink-tertiary">
                  {row.delta > 0 ? "↑" : "↓"}{Math.abs(row.delta)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { TimelineChart, StackedBarChart, LollipopChart });
