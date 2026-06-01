import type { LanguageFlagRow } from '../../lib/mirrorData';

interface LangSmallMultiplesProps {
  categories: LanguageFlagRow[];
}

// Deterministic LCG so the synthetic per-week series doesn't reshuffle on
// re-render — keeping the small-multiples grid visually stable.
function series(seed: number, total: number): number[] {
  let s = seed;
  const out: number[] = [];
  let remaining = total;
  for (let i = 0; i < 13; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    const v = Math.min(remaining, Math.round(r * (total / 7) + 0.3));
    out.push(v);
    remaining -= v;
  }
  return out;
}

// 13-week small-multiples grid — one sparkline cell per category. Synthetic
// series for now; swap for a real per-week count when the backend lands.
export function LangSmallMultiples({ categories }: LangSmallMultiplesProps) {
  return (
    <div className="grid grid-cols-3 gap-x-12 gap-y-8">
      {categories.map((c, i) => {
        const data = series(c.count * 991 + i * 17, c.count);
        const max = Math.max(1, ...data);
        return (
          <div key={c.id}>
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-base text-ink truncate">{c.label}</div>
              <div className="font-mono text-sm tabular-nums text-ink-secondary">{c.count}</div>
            </div>
            <svg
              width="100%"
              height="40"
              viewBox="0 0 200 40"
              preserveAspectRatio="none"
              className="block"
            >
              {data.map((v, j) => {
                const x = (j / (data.length - 1)) * 200;
                const h = (v / max) * 32;
                return (
                  <line
                    key={j}
                    x1={x}
                    y1={36}
                    x2={x}
                    y2={36 - h}
                    stroke="var(--color-text-primary)"
                    strokeWidth="1"
                  />
                );
              })}
              <line
                x1="0"
                y1="37"
                x2="200"
                y2="37"
                stroke="var(--color-border)"
                strokeWidth="1"
              />
            </svg>
            <div className="flex justify-between font-mono text-xs text-ink-tertiary mt-2">
              <span>13 wks ago</span>
              <span>this week</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
