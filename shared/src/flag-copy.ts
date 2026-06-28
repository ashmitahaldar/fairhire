import type { FlagType } from './types';

// Plain-language, one-line explainer for each flag type — the "why was this
// flagged" copy shown on an expanded flag card. Mode-agnostic: hiring and
// promotion types both live here so a single map covers both taxonomies.
// Kept in shared so the wording is one source of truth (the Flag Review screen
// is the only consumer today, but the HR view / docs may reuse it).
//
// Tone: descriptive, not accusatory — a flag is a prompt to look again, not a
// verdict. See the "How this works" panel copy in the web app for the
// confidence/severity/dismissal framing.
export const FLAG_TYPE_EXPLAINERS: Record<FlagType, string> = {
  biased_language:
    'Wording that carries a stereotype or loaded assumption about a group.',
  criteria_drift:
    "A standard introduced for this candidate that wasn't applied to others.",
  asymmetric_concern:
    "A concern raised for this candidate that comparable candidates didn't get.",
  hedging_language:
    "A 'culture/team fit' doubt stated without specific behavioural evidence.",
  age_bias:
    "Energy / pace / 'career stage' language that can stand in for age.",
  potential_vs_performance:
    'Rewarding perceived potential over demonstrated, evidenced work.',
  tenure_framing:
    'Treating time-in-seat as if it were contribution or readiness.',
  peer_comparison_bias:
    "Judging against one named peer rather than the level's rubric.",
  confidence_proxy:
    "'Needs more presence/assertiveness' framing that can proxy for protected traits.",
};
