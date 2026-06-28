import { useState } from 'react';
import { SEVERITY_THRESHOLDS } from '../../lib/severity';

// Plain-language explainer for the Flag Review screen: what a flag is, what
// confidence and severity actually mean, and what dismissing does (and
// doesn't do). Collapsed by default so the dense gutter stays uncluttered;
// the per-type "why this flag" copy lives on the expanded cards instead.
// Mode-agnostic — this framing is identical for hiring and promotion.

const HIGH = SEVERITY_THRESHOLDS.high.toFixed(2);
const MED = SEVERITY_THRESHOLDS.med.toFixed(2);

function InfoMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current text-[10px] font-serif italic leading-none"
    >
      i
    </span>
  );
}

export function HowThisWorksPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-sm text-ink-tertiary hover:text-ink-secondary transition-colors duration-120"
      >
        <InfoMark />
        How this works
      </button>

      {open && (
        <div className="mt-3 p-4 bg-surface-sunk border border-hairline rounded-card space-y-3 text-sm text-ink-secondary leading-relaxed">
          <p>
            <span className="font-serif italic text-ink">What a flag is — </span>
            A prompt to look again at your own wording, not a verdict on the candidate.
          </p>
          <p>
            <span className="font-serif italic text-ink">Confidence — </span>
            How likely the model thinks this wording reflects a real pattern — not how
            harmful it is, and not proof.
          </p>
          <p>
            <span className="font-serif italic text-ink">Severity — </span>
            A plain band of that confidence score: High (≥{HIGH}), Med ({MED}–{HIGH}),
            Low (below {MED}).
          </p>
          <p>
            <span className="font-serif italic text-ink">Dismissing — </span>
            Records your reason and moves the flag to the dismissed list for this debrief.
            It doesn't delete the note, train the model, or change anything for other
            managers or HR.
          </p>
        </div>
      )}
    </div>
  );
}
