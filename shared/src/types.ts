export type Role = 'manager' | 'hr_admin';

export type DecisionOutcome = 'hired' | 'rejected' | 'in_progress';

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export type FlagType =
  | 'biased_language'
  | 'criteria_drift'
  | 'asymmetric_concern'
  | 'hedging_language'
  | 'age_bias';

export type NationalityStatus = 'citizen' | 'pr' | 'ep_holder' | 's_pass' | 'other';

export type Race = 'chinese' | 'malay' | 'indian' | 'other';

export type AgeBand = 'under_30' | '30_39' | '40_49' | '50_plus';

export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
