import { Rule, type PhraseEntry } from './Rule';

// Lower confidence band than other rules — phrase detection is a proxy for criteria drift.
// True criteria drift (asymmetric application of standards across candidates) requires
// cross-candidate comparison, which only the LLM layer can perform.
const PHRASES: PhraseEntry[] = [
  {
    pattern: /accent and phrasing/i,
    confidence: 0.85,
    reasoning: 'Citing accent or phrasing as a barrier to progression applies a communication standard that is not applied to native English speakers — a hallmark of criteria drift.',
    suggestedAlt: 'Assess communication against a defined standard applied equally to all candidates: e.g. "Can the candidate explain complex concepts clearly to a non-technical audience?"',
  },
  {
    pattern: /English fluency concerns/i,
    confidence: 0.82,
    reasoning: 'Framing English fluency as a concern without a consistent standard across all candidates suggests the criterion is being applied selectively.',
    suggestedAlt: 'If English fluency is a genuine requirement, define the standard (e.g. "must present confidently to English-speaking clients") and apply it to all candidates.',
  },
  {
    pattern: /language barrier/i,
    confidence: 0.82,
    reasoning: '"Language barrier" characterises the candidate\'s communication as an inherent deficit rather than assessing whether they meet a defined standard.',
    suggestedAlt: 'Describe the specific communication requirement and assess whether the candidate met it — using the same standard applied to all candidates.',
  },
  {
    pattern: /communication gap/i,
    confidence: 0.80,
    reasoning: 'A "communication gap" cited only for certain candidates may indicate that the communication standard is being applied unevenly.',
    suggestedAlt: 'Document the specific communication competency being assessed and score all candidates against it using the same rubric.',
  },
  {
    pattern: /clear and confident English/i,
    confidence: 0.75,
    reasoning: 'Emphasising "clear and confident English" as a specific concern for this candidate — if not applied equally to all — is a marker of criteria drift.',
    suggestedAlt: 'If client-facing English communication is a requirement, use a structured assessment (e.g. presentation exercise) scored the same way for every candidate.',
  },
  {
    pattern: /difficult to follow/i,
    confidence: 0.72,
    reasoning: '"Difficult to follow" applied to certain candidates but not others with comparable complexity of ideas may indicate an inconsistent standard.',
    suggestedAlt: 'Describe the specific instance where communication broke down and assess whether the same standard would have been applied to other candidates.',
  },
  {
    pattern: /English communication is critical/i,
    confidence: 0.78,
    reasoning: 'Invoking English communication as a critical criterion specifically for this candidate suggests the bar is being set differently based on background.',
    suggestedAlt: 'Define the communication standard for the role and apply it to every candidate in the same way.',
  },
  {
    pattern: /improve (?:his |her |their )?English/i,
    confidence: 0.82,
    reasoning: 'Recommending English improvement as a condition for re-application signals that language is being used as a filter, potentially in place of objective performance criteria.',
    suggestedAlt: 'If there is a specific communication gap, identify whether it is a skills issue (trainable) or a role-critical blocker, and apply the same logic to all candidates.',
  },
];

export class CriteriaDriftRule extends Rule {
  readonly id = 'criteria-drift';
  readonly flagType = 'criteria_drift' as const;
  protected readonly phrases = PHRASES;
}
