import { Rule, type PhraseEntry } from './Rule';

// Promotion-mode rule. Flags language that rewards perceived future
// potential ("has a lot of potential", "could be ready in time", "could
// grow into the role") rather than demonstrated work at the level. The
// failure mode is acute in promotion decisioning: representation
// research consistently shows majority-group candidates promoted on
// potential while under-represented candidates are held to a
// demonstrated-impact bar.
//
// Conservative phrase list — the LLM picks up the broader pattern; the
// rules engine catches the verbatim, high-confidence forms.
const PHRASES: PhraseEntry[] = [
  {
    pattern: /(?:lots of|a lot of|huge|enormous|tremendous)\s+potential/i,
    confidence: 0.88,
    reasoning:
      '"Lots of potential" as a promotion argument privileges projection over demonstrated impact at the target level. Representation research links potential-based promotion to majority-group advancement.',
    suggestedAlt:
      'Cite a specific scope of work the employee has already delivered at the target level, or note explicitly that the case rests on growth signals rather than demonstrated impact.',
  },
  {
    pattern: /(?:could|might)\s+grow into the role/i,
    confidence: 0.85,
    reasoning:
      '"Could grow into the role" frames promotion as a development bet rather than an earned outcome — a framing that shows up disproportionately for under-represented candidates in research.',
    suggestedAlt:
      'Identify the level rubric criteria the employee already meets today and the gap, if any, that the promotion is intended to close.',
  },
  {
    pattern: /he\s+(?:has|shows|is showing)\s+(?:real |strong |clear )?potential/i,
    confidence: 0.80,
    reasoning:
      'Citing potential without a demonstrated track record can substitute optimism for evidence in promotion decisions.',
    suggestedAlt:
      'Name a specific deliverable or outcome that demonstrates the employee is already operating at the next level.',
  },
  {
    pattern: /she\s+(?:has|shows|is showing)\s+(?:real |strong |clear )?potential/i,
    confidence: 0.80,
    reasoning:
      'Citing potential without a demonstrated track record can substitute optimism for evidence in promotion decisions.',
    suggestedAlt:
      'Name a specific deliverable or outcome that demonstrates the employee is already operating at the next level.',
  },
  {
    pattern: /(?:ready|not quite ready)\s+in\s+(?:a year|twelve months|the next cycle)/i,
    confidence: 0.78,
    reasoning:
      'Projecting readiness on a timeline ("ready in a year") moves the bar from current performance to forecast — a common entry point for affinity bias.',
    suggestedAlt:
      'Anchor the recommendation in the current cycle\'s observable outcomes rather than a future readiness estimate.',
  },
  {
    pattern: /high\s+ceiling/i,
    confidence: 0.78,
    reasoning:
      '"High ceiling" language elevates projected upside over demonstrated work; in promotion decisions it can quietly displace a same-level performance comparison.',
    suggestedAlt:
      'Describe the specific work that already meets the target-level rubric, separate from any view about long-term trajectory.',
  },
];

export class PotentialVsPerformanceRule extends Rule {
  readonly id = 'potential-vs-performance';
  readonly flagType = 'potential_vs_performance' as const;
  protected readonly phrases = PHRASES;
}
