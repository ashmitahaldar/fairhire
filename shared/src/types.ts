export type Role = 'manager' | 'hr_admin';

export type DecisionOutcome = 'hired' | 'rejected' | 'in_progress';

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export const FLAG_TYPES = [
  'biased_language',
  'criteria_drift',
  'asymmetric_concern',
  'hedging_language',
  'age_bias',
] as const;

export type FlagType = (typeof FLAG_TYPES)[number];

export type NationalityStatus = 'citizen' | 'pr' | 'ep_holder' | 's_pass' | 'other';

export type Race = 'chinese' | 'malay' | 'indian' | 'other';

export type AgeBand = 'under_30' | 'age_30_39' | 'age_40_49' | 'age_50_plus';

export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
