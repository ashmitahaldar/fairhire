import type { MirrorNudge } from '../../lib/mirrorData';

interface NudgeCardProps {
  nudge: MirrorNudge;
  onSeeInstances?: (n: MirrorNudge) => void;
}

// Serif pull-quote tile on a sunk surface — no border. The optional CTA links
// to the named tab (display-only; tab switching is handled by the parent).
export function NudgeCard({ nudge, onSeeInstances }: NudgeCardProps) {
  return (
    <article className="bg-surface-sunk p-8 flex flex-col h-full">
      <div className="font-serif italic text-sm text-ink-tertiary mb-5">{nudge.tag}</div>
      <p className="font-serif text-section text-ink leading-snug mb-6 [text-wrap:pretty] flex-1">
        {nudge.sentence}
      </p>
      {nudge.linkTo && (
        <button
          type="button"
          onClick={() => onSeeInstances?.(nudge)}
          className="self-start text-sm text-ink font-medium underline decoration-hairline underline-offset-4 hover:decoration-ink transition-colors duration-120"
        >
          See in {nudge.linkTo} ›
        </button>
      )}
    </article>
  );
}
