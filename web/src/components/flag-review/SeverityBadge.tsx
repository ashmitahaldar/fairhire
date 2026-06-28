import type { SeverityKey } from '../../lib/severity';
import { InfoPopover } from '../shared/primitives';

interface SeverityBadgeProps {
  tier: SeverityKey;
  label: string;
  score: number;
}

// Three distinct visual languages per Section 2 of the Week 5 plan:
//   HIGH (≥0.75) — filled oxblood pill (the "this is signal" treatment)
//   MED  (≥0.5)  — hairline-bordered chip in ink-secondary
//   LOW  (<0.5)  — pure typographic, tertiary italic, no border or chip
//
// Score is rendered to 2 decimals throughout to match the Week 4
// ConfidenceIndicator format; the small fill bar from that component
// is dropped because the badge itself now encodes the tier.
//
// The badge is the trigger for an InfoPopover carrying the confidence framing
// (it's the detector's likelihood, not a measure of harm). That copy used to
// live in a hover-only `title=` — now it's keyboard- and touch-accessible, and
// mirrors the "How this works" panel so the two never drift.
export function SeverityBadge({ tier, label, score }: SeverityBadgeProps) {
  const scoreText = score.toFixed(2);
  const aria = `${label} severity, confidence ${scoreText}. What confidence means.`;
  const content = (
    <>
      <span className="font-serif italic text-ink">{label} severity</span> · confidence {scoreText}.
      How likely the model thinks this wording reflects a real pattern — not how harmful it is, and
      not proof.
    </>
  );

  if (tier === 'high') {
    return (
      <InfoPopover
        label={aria}
        content={content}
        triggerClassName="inline-flex items-baseline gap-1 font-mono text-xs px-2 py-0.5 rounded-input bg-accent text-ink-inverse"
      >
        <span className="font-medium uppercase tracking-meta">{label}</span>
        <span className="opacity-80">·</span>
        <span className="tabular-nums">{scoreText}</span>
      </InfoPopover>
    );
  }

  if (tier === 'med') {
    return (
      <InfoPopover
        label={aria}
        content={content}
        triggerClassName="inline-flex items-baseline gap-1 font-mono text-xs px-2 py-0.5 rounded-input border border-hairline text-ink-secondary"
      >
        <span className="font-medium uppercase tracking-meta">{label}</span>
        <span className="text-ink-tertiary">·</span>
        <span className="tabular-nums">{scoreText}</span>
      </InfoPopover>
    );
  }

  // LOW: typographic only. Serif italic + tertiary ink + lowercase label
  // signals "lowest signal-quality tier" without dimming the card body.
  return (
    <InfoPopover
      label={aria}
      content={content}
      triggerClassName="inline-flex items-baseline gap-1 font-serif italic text-sm text-ink-tertiary"
    >
      <span>{label.toLowerCase()}</span>
      <span>·</span>
      <span className="font-mono text-xs tabular-nums not-italic">{scoreText}</span>
    </InfoPopover>
  );
}
