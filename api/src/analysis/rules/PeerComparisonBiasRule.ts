import { Rule, type PhraseEntry } from './Rule';

// Promotion-mode rule. Flags reasoning that benchmarks against a
// single named peer rather than the level rubric — "not as strong as
// [Name]", "compared to [Name]", "in the way [Name] does". The
// failure mode is twofold: (1) the comparator is almost always someone
// already at the next level, so the bar shifts from the rubric to that
// peer's individual style; (2) named-peer comparisons inherit any bias
// in how the comparator was originally evaluated.
//
// Detection uses a generic name pattern (Capitalised word followed by
// a verb or possessive) because we don't know peer names in advance.
// Kept conservative; the LLM handles broader paraphrases.
const PHRASES: PhraseEntry[] = [
  {
    // Case in the leading verb is alternated explicitly ([Nn]ot, [Cc]ompared,
    // etc.) so the regex can pick up sentence-start capitals without
    // weakening the name detection — `[A-Z][a-z]+` is intentionally
    // case-sensitive because we're keying off a proper-noun.
    pattern: /[Nn]ot (?:as|quite) (?:strong|good|sharp|polished) as [A-Z][a-z]+/,
    confidence: 0.88,
    reasoning:
      'Comparing the candidate to a single named peer rather than the level rubric replaces the framework with one individual\'s style — a common path for affinity bias.',
    suggestedAlt:
      'Anchor the comparison in the level rubric. If a peer comparison is necessary, name the specific rubric criterion they are stronger on.',
  },
  {
    pattern: /[Cc]ompared (?:directly )?(?:to|with) [A-Z][a-z]+/,
    confidence: 0.78,
    reasoning:
      'Direct comparison to a single named peer transfers evaluation criteria from the rubric to one individual — a structurally narrow basis for a promotion decision.',
    suggestedAlt:
      'State the rubric criterion at stake and assess the employee against the criterion, citing the peer only as additional context if relevant.',
  },
  {
    pattern: /(?:[Ii]n the way|[Tt]he way that) [A-Z][a-z]+ (?:does|did|handles|handled|approaches|approached)/,
    confidence: 0.80,
    reasoning:
      'Holding the candidate to "the way [Name] does it" anchors evaluation in a single peer\'s style rather than the level rubric and disadvantages anyone with a different working approach.',
    suggestedAlt:
      'Identify the rubric criterion the peer\'s approach exemplifies and assess the candidate against that criterion, not the peer\'s personal style.',
  },
  {
    pattern: /(?:[Ll]ike|[Tt]he way) [A-Z][a-z]+ (?:would|does|handled)/,
    confidence: 0.72,
    reasoning:
      '"Like [Name] would" sets a single peer as the benchmark — typically the strongest in the manager\'s mind, narrowing the evaluation to one style.',
    suggestedAlt:
      'Replace the peer-as-benchmark with the level rubric\'s criterion description.',
  },
  {
    pattern: /[A-Z][a-z]+ (?:at this (?:stage|level|point)|in (?:his|her|their) shoes) (?:would|did|had)/,
    confidence: 0.78,
    reasoning:
      'Holding the candidate to what a specific peer "would have done at this stage" turns one individual\'s trajectory into the benchmark for the level, sidelining the rubric.',
    suggestedAlt:
      'Use the level rubric\'s explicit expectation at this stage rather than a single colleague\'s prior trajectory.',
  },
];

export class PeerComparisonBiasRule extends Rule {
  readonly id = 'peer-comparison-bias';
  readonly flagType = 'peer_comparison_bias' as const;
  protected readonly phrases = PHRASES;
}
