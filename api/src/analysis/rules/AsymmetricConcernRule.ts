import { Rule, type PhraseEntry } from './Rule';

const PHRASES: PhraseEntry[] = [
  {
    pattern: /plans for starting a family/i,
    confidence: 0.95,
    reasoning: 'Interview raised family-planning intentions, a question that is almost never asked of male candidates and is irrelevant to job performance.',
    suggestedAlt: 'Focus on availability and travel requirements using the same language for all candidates.',
  },
  {
    pattern: /starting a family/i,
    confidence: 0.92,
    reasoning: 'Reference to family-planning intentions in an interview context is an asymmetric concern — it implies the candidate\'s reproductive choices are a factor in the hiring decision.',
    suggestedAlt: 'Ask all candidates about their availability for the role\'s travel and on-call requirements.',
  },
  {
    pattern: /childcare arrangements/i,
    confidence: 0.93,
    reasoning: 'Questioning childcare logistics singles out candidates (almost always women) with children, creating an unequal evaluation standard.',
    suggestedAlt: 'Ask all candidates: "This role requires occasional short-notice travel — can you meet that requirement?"',
  },
  {
    pattern: /family responsibilities/i,
    confidence: 0.82,
    reasoning: 'Framing a candidate\'s family life as a professional concern implies their domestic obligations — not their skills — are under evaluation.',
    suggestedAlt: 'If availability is a real requirement, state it explicitly and ask every candidate the same availability question.',
  },
  {
    pattern: /family commitments/i,
    confidence: 0.80,
    reasoning: 'References to "family commitments" in an assessment context suggest the candidate\'s personal life is being weighed against job performance.',
    suggestedAlt: 'Discuss specific role requirements (e.g. overnight travel frequency) with all candidates equally.',
  },
  {
    pattern: /school calendar/i,
    confidence: 0.78,
    reasoning: 'Mentioning the school calendar implies the candidate\'s childcare schedule is a hiring factor — an asymmetric concern not applied to candidates without children.',
    suggestedAlt: 'State the travel and availability expectations clearly and ask all candidates if they can meet them.',
  },
  {
    pattern: /personal commitments at this life stage/i,
    confidence: 0.90,
    reasoning: '"Life stage" is coded language that implies age or family status are factors in the evaluation.',
    suggestedAlt: 'Describe the role\'s actual demands and ask all candidates whether they can meet them.',
  },
];

export class AsymmetricConcernRule extends Rule {
  readonly id = 'asymmetric-concern';
  readonly flagType = 'asymmetric_concern' as const;
  protected readonly phrases = PHRASES;
}
