import type { PipelineRow } from '../../lib/mirrorData';

interface ConversionGridProps {
  pipeline: PipelineRow[];
}

interface ConversionRow {
  label: string;
  repPct: number;
  majPct: number;
  gap: number;       // positive = majority advances at higher rate
}

// Pure: pipeline → per-transition conversion rates for represented vs majority.
// Exported so the math is testable in isolation.
export function computeConversionRows(pipeline: PipelineRow[]): ConversionRow[] {
  const rows: ConversionRow[] = [];
  for (let i = 1; i < pipeline.length; i++) {
    const prev = pipeline[i - 1];
    const curr = pipeline[i];
    const repPct = (curr.represented / prev.represented) * 100;
    const majPct = (curr.majority / prev.majority) * 100;
    rows.push({
      label: `${prev.stage} → ${curr.stage}`,
      repPct,
      majPct,
      gap: majPct - repPct,
    });
  }
  return rows;
}

// Per-transition conversion rates with a "gap" callout. >5pp gaps render in
// the accent colour — a narrative highlight tied to the demographics nudges.
export function ConversionGrid({ pipeline }: ConversionGridProps) {
  const rows = computeConversionRows(pipeline);
  return (
    <div className="space-y-5">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[260px_1fr] gap-8 items-center"
        >
          <div className="text-base text-ink">{row.label}</div>
          <div className="grid grid-cols-[1fr_1fr_120px] gap-4 items-center">
            <ConversionBar label="Represented" pct={row.repPct} />
            <ConversionBar label="Majority" pct={row.majPct} />
            <div className="text-sm text-right">
              <span className="font-serif italic text-ink-tertiary">gap </span>
              <span
                className={`font-mono tabular-nums ${row.gap > 5 ? 'text-accent' : 'text-ink'}`}
              >
                {row.gap > 0 ? '+' : ''}
                {row.gap.toFixed(0)}pp
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConversionBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="font-mono text-sm text-ink-tertiary mb-1">{label}</div>
      <div className="flex items-baseline gap-3">
        <div className="font-serif text-section text-ink tabular-nums">{pct.toFixed(0)}%</div>
        <div className="h-1 flex-1" style={{ background: 'var(--color-border)' }}>
          <div
            className="h-full"
            style={{ width: `${pct}%`, background: 'var(--color-text-primary)' }}
          />
        </div>
      </div>
    </div>
  );
}
