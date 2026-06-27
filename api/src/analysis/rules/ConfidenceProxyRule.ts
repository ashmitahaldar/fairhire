import { Rule, type PhraseEntry } from './Rule';

// Promotion-mode rule. Flags "needs more presence" / "more assertive"
// / "needs more gravitas" feedback that operates as a proxy for
// protected traits — most consistently, gender and (in Singapore
// banking) accent/race-coded perception of authority. The failure
// mode is that the feedback names a trait that is not on the level
// rubric and is famously unevenly applied. Research is consistent
// that women and under-represented groups receive these critiques at
// materially higher rates and are penalised more for the perception
// regardless of contribution.
const PHRASES: PhraseEntry[] = [
  {
    pattern: /needs more (?:presence|gravitas|confidence|authority|executive presence)/i,
    confidence: 0.90,
    reasoning:
      '"Presence" / "gravitas" / "executive presence" feedback is rarely operationalised, is unevenly applied across demographics, and tends to surface in performance reviews more often for women and minorities than for majority-group peers.',
    suggestedAlt:
      'Name the specific observed behaviour and the specific outcome you want to see instead — e.g. "in the partner meeting, summarised the risk position in 30 seconds" — so the feedback can be evaluated and acted on.',
  },
  {
    // Require the comparative "more assertive" deficit framing. Matching
    // the bare word "assertive" also fires on positive usage ("she was
    // assertive and well-prepared") — a false positive in a bias-detection
    // tool. The "not … enough" framing is covered by a separate entry below.
    pattern: /more assertive(?:\s+in (?:the )?(?:room|meetings|sessions))?/i,
    confidence: 0.78,
    reasoning:
      '"More assertive" is a feedback frame that lands disproportionately on women and softer-spoken candidates. Without a behavioural anchor it functions as a style preference, not a capability gap.',
    suggestedAlt:
      'Identify the moment you wanted the candidate to speak up and what specifically they should have said. If the gap is one of contribution, name the contribution; if it is of style, weigh whether style is on the rubric.',
  },
  {
    pattern: /(?:she|he|they) (?:should|needs to) speak up more/i,
    confidence: 0.82,
    reasoning:
      '"Should speak up more" attributes a capability shortfall to volume. It correlates strongly with gendered feedback patterns and rarely captures the actual contribution gap.',
    suggestedAlt:
      'Cite an example where the candidate had a relevant view and didn\'t share it, and describe the contribution you would have wanted.',
  },
  {
    pattern: /not (?:assertive|forceful|forward) enough/i,
    confidence: 0.85,
    reasoning:
      '"Not forceful/forward enough" frames the candidate\'s working style as a deficit without naming an unmet rubric requirement. Often paired with same-style candidates who are not flagged for the inverse.',
    suggestedAlt:
      'Translate the feedback into a rubric criterion (e.g. "negotiation outcomes") and cite a specific instance against that criterion.',
  },
  {
    pattern: /(?:more|stronger)\s+(?:executive|leadership)\s+presence/i,
    confidence: 0.88,
    reasoning:
      '"Executive presence" / "leadership presence" is a notoriously unevenly-applied criterion that often encodes appearance, accent, and demographic norms rather than capability.',
    suggestedAlt:
      'Replace with a specific leadership behaviour at the target level (e.g. "owns the room in difficult client escalations") and cite an example.',
  },
  {
    pattern: /(?:lacks|lacking)\s+(?:confidence|presence|gravitas)/i,
    confidence: 0.85,
    reasoning:
      '"Lacks confidence/presence/gravitas" cited as a promotion gap is a trait observation rather than a rubric one. These observations are documented to fall harder on women and under-represented groups.',
    suggestedAlt:
      'Replace the trait observation with a behaviour: in what specific situation did the candidate visibly hesitate, and what was the consequence? Then weigh whether that maps to the rubric.',
  },
];

export class ConfidenceProxyRule extends Rule {
  readonly id = 'confidence-proxy';
  readonly flagType = 'confidence_proxy' as const;
  protected readonly phrases = PHRASES;
}
