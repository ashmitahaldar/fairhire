import { Fragment } from 'react';
import type { CSSProperties } from 'react';
import type { FlagVM, TranscriptParagraph } from '../../lib/flagReview';

// Ported from the design drop's transcript.jsx. Renders the adapter's segmented
// paragraphs as serif body text, wrapping flagged regions in `.fh-span`. Pending
// (not-yet-revealed) flags still render a span carrying `data-flag-span` (marked
// data-pending) so the Marginalia gutter can measure positions consistently and
// the layout doesn't shift on reveal. The superscript shows the flag's display
// `index` (real ids are UUIDs), and the plumbed `isHovered` is wired to a
// thickness bump for span↔card cross-highlight.

const HOVER_STYLE: CSSProperties = { textDecorationThickness: '2px' };

interface FlaggedSpanProps {
  flag: FlagVM;
  text: string;
  isActive: boolean;
  isDismissed: boolean;
  isVisible: boolean;
  isHovered: boolean;
  onActivate: (id: string) => void;
  onHover: (id: string | null) => void;
}

function FlaggedSpan({
  flag,
  text,
  isActive,
  isDismissed,
  isVisible,
  isHovered,
  onActivate,
  onHover,
}: FlaggedSpanProps) {
  // While streaming in, render the words plainly but keep data-flag-span so the
  // gutter can still measure this position.
  if (!isVisible) {
    return (
      <span data-flag-span={flag.id} data-pending="true">
        {text}
      </span>
    );
  }

  const classes = ['fh-span', isActive && 'is-active', isDismissed && 'is-dismissed']
    .filter(Boolean)
    .join(' ');

  return (
    <span
      data-flag-span={flag.id}
      className={classes}
      style={isHovered && !isActive ? HOVER_STYLE : undefined}
      onClick={() => onActivate(flag.id)}
      onMouseEnter={() => onHover(flag.id)}
      onMouseLeave={() => onHover(null)}
    >
      {text}
      <sup className="font-mono">{flag.index}</sup>
    </span>
  );
}

interface TranscriptProps {
  paragraphs: TranscriptParagraph[];
  flagsById: Record<string, FlagVM>;
  activeFlagId: string | null;
  hoveredFlagId: string | null;
  visibleFlagIds: Set<string>;
  dismissedFlagIds: Set<string>;
  onActivate: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function Transcript({
  paragraphs,
  flagsById,
  activeFlagId,
  hoveredFlagId,
  visibleFlagIds,
  dismissedFlagIds,
  onActivate,
  onHover,
}: TranscriptProps) {
  return (
    <div className="font-serif text-body text-ink leading-[1.6] [text-wrap:pretty] space-y-6">
      {paragraphs.map((segments, pi) => (
        <p key={pi}>
          {segments.map((seg, si) => {
            if (seg.kind === 'text') return <Fragment key={si}>{seg.text}</Fragment>;
            const flag = flagsById[seg.flagId];
            if (!flag) return <Fragment key={si}>{seg.text}</Fragment>;
            return (
              <FlaggedSpan
                key={si}
                flag={flag}
                text={seg.text}
                isActive={activeFlagId === flag.id}
                isHovered={hoveredFlagId === flag.id}
                isVisible={visibleFlagIds.has(flag.id)}
                isDismissed={dismissedFlagIds.has(flag.id)}
                onActivate={onActivate}
                onHover={onHover}
              />
            );
          })}
        </p>
      ))}
    </div>
  );
}
