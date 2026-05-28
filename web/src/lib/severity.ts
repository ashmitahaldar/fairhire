// Severity tiers derived from a flag's confidence score. This is the single
// source of truth for the thresholds — no other module hard-codes these cuts.

export const SEVERITY_THRESHOLDS = {
  /** confidence >= this → high */
  high: 0.75,
  /** confidence >= this (and below `high`) → med; anything lower → low */
  med: 0.5,
} as const;

export type SeverityKey = 'high' | 'med' | 'low';

export interface Severity {
  key: SeverityKey;
  label: string;
}

const LABELS: Record<SeverityKey, string> = {
  high: 'High',
  med: 'Med',
  low: 'Low',
};

export function severityFor(confidence: number): Severity {
  const key: SeverityKey =
    confidence >= SEVERITY_THRESHOLDS.high
      ? 'high'
      : confidence >= SEVERITY_THRESHOLDS.med
        ? 'med'
        : 'low';
  return { key, label: LABELS[key] };
}
