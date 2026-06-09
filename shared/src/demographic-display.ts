import type { AgeBand, Gender, NationalityStatus, Race } from './types';

// Canonical display labels for the demographic enums. Schema literals are
// snake_case (the database source of truth); these are the human-readable
// forms users see in dropdowns, table chips, and modal selectors. Single
// source so the candidate modal, the candidates-table chip, and any future
// HR surface render the same words.
//
// Add abbreviation maps locally to the consumer (e.g. RACE_SHORT on the
// table row) when needed — these full-length maps are for forms and prose.

export const RACE_LABELS: Record<Race, string> = {
  chinese: 'Chinese',
  malay: 'Malay',
  indian: 'Indian',
  other: 'Other',
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
};

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  under_30: 'Under 30',
  age_30_39: '30–39',
  age_40_49: '40–49',
  age_50_plus: '50+',
};

export const NATIONALITY_STATUS_LABELS: Record<NationalityStatus, string> = {
  citizen: 'Citizen',
  pr: 'PR',
  ep_holder: 'EP holder',
  s_pass: 'S Pass',
  other: 'Other',
};
