import { Rule, type PhraseEntry } from './Rule';

const PHRASES: PhraseEntry[] = [
  {
    pattern: /culture and team fit/i,
    confidence: 0.90,
    reasoning: '"Culture and team fit" without specific behavioural evidence is a vague justification that can mask demographic bias.',
    suggestedAlt: 'Cite specific observed behaviours: e.g. "During the group exercise, the candidate did not build on others\' ideas."',
  },
  {
    pattern: /cultural fit/i,
    confidence: 0.88,
    reasoning: '"Cultural fit" is a frequently cited but undefined criterion that is associated with homogeneous hiring. Without a concrete definition it cannot be evaluated fairly.',
    suggestedAlt: 'Define what "fit" means operationally — e.g. "communicates proactively", "adapts quickly to feedback" — and assess all candidates against the same criteria.',
  },
  {
    pattern: /culture fit/i,
    confidence: 0.88,
    reasoning: '"Culture fit" cited without evidence or definition is a subjective criterion that is difficult to audit for fairness.',
    suggestedAlt: 'Replace with specific, behavioural observations tied to the role\'s competency framework.',
  },
  {
    pattern: /hard to gel/i,
    confidence: 0.88,
    reasoning: '"Hard to gel" is an interpersonal impression with no behavioural anchor — it is highly susceptible to affinity bias.',
    suggestedAlt: 'Describe a specific interaction or response that raised the concern, so it can be evaluated on its merits.',
  },
  {
    pattern: /gel with/i,
    confidence: 0.85,
    reasoning: 'Whether someone will "gel with" the team is a subjective impression that often reflects similarity bias rather than capability.',
    suggestedAlt: 'Identify the specific competency at stake (e.g. collaboration, communication style) and assess it with a structured question.',
  },
  {
    pattern: /fit with.*?team/i,
    confidence: 0.85,
    reasoning: 'Team fit language without supporting evidence is a common vector for in-group favouritism and can disadvantage candidates from minority backgrounds.',
    suggestedAlt: 'Ground the concern in observable behaviour: what specifically did the candidate say or do that raised this concern?',
  },
  {
    pattern: /working style/i,
    confidence: 0.72,
    reasoning: '"Working style" cited as a concern without concrete examples can be a proxy for demographic or personality-based bias.',
    suggestedAlt: 'Describe the specific working style mismatch with an example: "When asked about handling conflicting priorities, the candidate said X, which differs from our team\'s approach of Y."',
  },
  {
    pattern: /team dynamic/i,
    confidence: 0.72,
    reasoning: 'Concerns about "team dynamic" without specific behavioural evidence are difficult to distinguish from affinity bias.',
    suggestedAlt: 'Describe the specific aspect of team dynamic at risk and what the candidate said or did that raised the concern.',
  },
];

export class HedgingLanguageRule extends Rule {
  readonly id = 'hedging-language';
  readonly flagType = 'hedging_language' as const;
  protected readonly phrases = PHRASES;
}
