import { Rule, type PhraseEntry } from './Rule';

// Promotion-mode rule. Flags reasoning that treats tenure as the
// promotion case — "they've been here a while", "earned their stripes",
// "waited their turn". The failure mode is conflating loyalty or time
// served with contribution at the target level. Tenure-as-rationale
// also creates a structural disadvantage for lateral hires and anyone
// who joined the company more recently.
const PHRASES: PhraseEntry[] = [
  {
    pattern: /(?:he|she|they)['']s? been (?:here|at the firm|with us) (?:for )?(?:a long time|a while|many years)/i,
    confidence: 0.85,
    reasoning:
      'Length of tenure is not evidence of readiness for the next level. Tenure-based promotion arguments disadvantage strong recent hires and conflate loyalty with contribution.',
    suggestedAlt:
      'Replace the tenure observation with a specific outcome from the current cycle that demonstrates target-level performance.',
  },
  {
    pattern: /earned (?:his|her|their) stripes/i,
    confidence: 0.88,
    reasoning:
      '"Earned their stripes" frames promotion as a reward for time served — it elevates seniority over demonstrated impact at the target level.',
    suggestedAlt:
      'Identify the work that demonstrates the employee is operating at the next level, independent of how long they have been with the team.',
  },
  {
    pattern: /(?:waited|put in)\s+(?:his|her|their)\s+turn/i,
    confidence: 0.88,
    reasoning:
      'Promotion order should track demonstrated impact at the target level, not a queue based on tenure. "Waited their turn" replaces evaluation with seniority.',
    suggestedAlt:
      'State the criteria the employee meets today; if no qualifying evidence exists, the case for promotion may not yet be ready.',
  },
  {
    pattern: /(?:loyal|loyalty)\s+to\s+the\s+(?:team|firm|company|bank)/i,
    confidence: 0.80,
    reasoning:
      'Loyalty is not in the level rubric. Promoting on loyalty rather than capability rewards staying put rather than performing.',
    suggestedAlt:
      'Translate the loyalty signal into a concrete behavioural outcome — e.g. retention of institutional context, mentoring tenure — and weight only what the rubric calls out.',
  },
  {
    pattern: /(?:put in|done)\s+(?:his|her|their)\s+time/i,
    confidence: 0.82,
    reasoning:
      'Time-served framing treats promotion as deferred compensation. The criterion is demonstrated work at the target level, not duration in the current role.',
    suggestedAlt:
      'Cite the work product that meets the next level\'s scope. If the case rests on tenure, the case is not yet ready.',
  },
  {
    pattern: /it['']s\s+(?:his|her|their)\s+time/i,
    confidence: 0.80,
    reasoning:
      '"It\'s their time" reasons from seniority rather than evidence. Often paired with under-articulated impact.',
    suggestedAlt:
      'Anchor the promotion case in two or three specific deliverables this cycle that demonstrate target-level capability.',
  },
];

export class TenureFramingRule extends Rule {
  readonly id = 'tenure-framing';
  readonly flagType = 'tenure_framing' as const;
  protected readonly phrases = PHRASES;
}
