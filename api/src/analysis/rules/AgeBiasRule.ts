import { Rule, type PhraseEntry } from './Rule';

const PHRASES: PhraseEntry[] = [
  {
    pattern: /energy levels and long-term commitment/i,
    confidence: 0.93,
    reasoning: 'Linking "energy levels" to "long-term commitment" in an assessment implies assumptions about the candidate\'s stamina or longevity based on age rather than demonstrated performance.',
    suggestedAlt: 'Assess commitment through evidence: tenure history, stated motivations, and specific responses about why they want this role.',
  },
  {
    pattern: /energy needed for the pace/i,
    confidence: 0.92,
    reasoning: 'Questioning whether a candidate has the "energy" for the role\'s pace — without a performance-based basis — is associated with age-based assumptions.',
    suggestedAlt: 'If pace is a genuine concern, ask all candidates: "This role regularly involves 60+ hour weeks during live deals. Can you describe a time you sustained high output over a long period?"',
  },
  {
    pattern: /current stage of (?:their |his |her )?career/i,
    confidence: 0.90,
    reasoning: '"Current stage of career" is often a coded reference to age, implying the candidate is past their peak productivity or commitment.',
    suggestedAlt: 'Focus on the specific competencies required for the role and assess the candidate\'s demonstrated track record against them.',
  },
  {
    pattern: /stage of (?:their |his |her )?career/i,
    confidence: 0.85,
    reasoning: 'References to career stage as a risk factor can be a proxy for age bias, particularly for candidates over 45.',
    suggestedAlt: 'Evaluate the candidate against role-specific criteria rather than inferred career trajectory.',
  },
  {
    pattern: /stamina and drive/i,
    confidence: 0.88,
    reasoning: 'Questioning "stamina and drive" without a performance basis implies physical or motivational assumptions tied to age.',
    suggestedAlt: 'Ask all candidates for evidence of sustained high-output performance: "Describe the most demanding period in your career and how you managed it."',
  },
  {
    pattern: /adaptability to newer/i,
    confidence: 0.85,
    reasoning: 'Assuming reduced adaptability to new tools or methods is an age stereotype unless the candidate has demonstrated a specific knowledge gap.',
    suggestedAlt: 'Assess tool proficiency directly with a skills test or specific questions about the tools used, rather than inferring it from career length.',
  },
  {
    pattern: /methodologies appear dated/i,
    confidence: 0.83,
    reasoning: '"Dated methodologies" may be legitimate if specifically evidenced, but framing it as an age-related characteristic rather than a skills gap is a bias indicator.',
    suggestedAlt: 'Identify the specific methodology gap and whether it is a blocker or a training opportunity. Assess all candidates for the same gap.',
  },
  {
    pattern: /long-term commitment unclear/i,
    confidence: 0.88,
    reasoning: 'Casting doubt on long-term commitment without evidence — particularly for senior candidates — often reflects assumptions about age or life stage.',
    suggestedAlt: 'Ask directly about career plans: "Where do you see yourself in five years?" and assess the answer on its merits.',
  },
  {
    pattern: /pace.*?might not (?:align|suit)/i,
    confidence: 0.85,
    reasoning: 'Suggesting the team\'s pace might not suit the candidate without a specific behavioural basis is often a proxy for age-related assumptions.',
    suggestedAlt: 'Describe the pace concretely and ask all candidates whether they have worked in a comparable environment.',
  },
];

export class AgeBiasRule extends Rule {
  readonly id = 'age-bias';
  readonly flagType = 'age_bias' as const;
  protected readonly phrases = PHRASES;
}
