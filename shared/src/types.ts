import { z } from 'zod';

export type Role = 'manager' | 'hr_admin';

// Widened in Week 5 to cover the Promotion mode (Section 3 of the Week 5
// plan). DecisionPanel renders different button trios based on
// Meeting.meetingType, but all five values share the same column.
//   hiring   → hired | rejected | in_progress
//   promotion→ promoted | held | in_progress
// Single source of truth so the write path (api decisions route) validates
// against the same set the UI offers — keep this and the Prisma enum aligned.
export const DECISION_OUTCOMES = [
  'hired',
  'rejected',
  'in_progress',
  'promoted',
  'held',
] as const;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];
export const decisionOutcomeSchema = z.enum(DECISION_OUTCOMES);

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

// ── Meeting mode ────────────────────────────────────────────────────────────
// Hiring vs Promotion split. Drives engine prompt branching, rule
// selection, the decision panel layout, and the Mirror tab set.

export const MEETING_TYPES = ['hiring', 'promotion'] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];
export const meetingTypeSchema = z.enum(MEETING_TYPES);

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  hiring: 'Hiring',
  promotion: 'Promotion',
};

// ── Flag types ─────────────────────────────────────────────────────────────

export const FLAG_TYPES = [
  'biased_language',
  'criteria_drift',
  'asymmetric_concern',
  'hedging_language',
  'age_bias',
  // ── Promotion-mode rules (Week 5) ────────────────────────────────────
  // These four fire only when Meeting.meetingType = 'promotion'.
  // Rule selection happens in api/src/analysis/rules/index.ts based on
  // the parent meeting's mode; the engine prompt also branches.
  'potential_vs_performance',
  'tenure_framing',
  'peer_comparison_bias',
  'confidence_proxy',
] as const;

export type FlagType = (typeof FLAG_TYPES)[number];

export const flagTypeSchema = z.enum(FLAG_TYPES);

// Hiring-mode FlagTypes — the original five. Used by the rule registry
// to gate which rules fire per mode, and by the Mirror's Language tab
// when meetingType=hiring.
export const HIRING_FLAG_TYPES = [
  'biased_language',
  'criteria_drift',
  'asymmetric_concern',
  'hedging_language',
  'age_bias',
] as const satisfies readonly FlagType[];

// Promotion-mode FlagTypes — added in Week 5. Each looks for a distinct
// failure mode in promotion decisioning: rewarding perceived potential
// over demonstrated work; conflating tenure with contribution; judging
// against a single named peer rather than the level rubric; and
// "needs more presence/assertiveness" feedback that proxies for
// protected traits.
export const PROMOTION_FLAG_TYPES = [
  'potential_vs_performance',
  'tenure_framing',
  'peer_comparison_bias',
  'confidence_proxy',
] as const satisfies readonly FlagType[];

// Human-readable labels used by the Mirror — server fills
// summary.topCategory from this map and the client renders
// languageFlags[].label from the same source. Single source so the two
// can't drift.
export const FLAG_TYPE_LABELS: Record<FlagType, string> = {
  biased_language: 'Biased language',
  criteria_drift: 'Shifting criteria',
  asymmetric_concern: 'Asymmetric concern',
  hedging_language: '"Culture fit" without evidence',
  age_bias: 'Energy / pace language',
  potential_vs_performance: 'Potential vs performance',
  tenure_framing: 'Tenure framing',
  peer_comparison_bias: 'Peer-comparison bias',
  confidence_proxy: 'Confidence proxy',
};

// ── Demographic enums (Zod-first so api Zod parsing and TS types share
// a single literal-value source) ────────────────────────────────────

export const NATIONALITY_STATUSES = [
  'citizen',
  'pr',
  'ep_holder',
  's_pass',
  'other',
] as const;
export type NationalityStatus = (typeof NATIONALITY_STATUSES)[number];
export const nationalityStatusSchema = z.enum(NATIONALITY_STATUSES);

export const RACES = ['chinese', 'malay', 'indian', 'other'] as const;
export type Race = (typeof RACES)[number];
export const raceSchema = z.enum(RACES);

export const AGE_BANDS = [
  'under_30',
  'age_30_39',
  'age_40_49',
  'age_50_plus',
] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
export const ageBandSchema = z.enum(AGE_BANDS);

export const GENDERS = [
  'male',
  'female',
  'non_binary',
  'prefer_not_to_say',
] as const;
export type Gender = (typeof GENDERS)[number];
export const genderSchema = z.enum(GENDERS);

// ── Pattern Mirror contract ────────────────────────────────────────────────
// Canonical types for the /mirror composite response. Mirrors the
// frontend's MirrorData contract so client and server agree without a
// hand-kept duplicate. The legacy duplicate in web/src/lib/mirrorData.ts
// stays until Step 4/6 of the Week 4 plan swaps it.

export const MIRROR_PERIODS = ['30d', '90d', '12m'] as const;
export type MirrorPeriod = (typeof MIRROR_PERIODS)[number];
export const mirrorPeriodSchema = z.enum(MIRROR_PERIODS);

// Race plus 'unknown' for candidates whose demographics row is missing
// or whose race field is null. The Demographics-tab chart bands all
// segments per stage.
export const RACE_SEGMENT_KEYS = [...RACES, 'unknown'] as const;
export type RaceSegmentKey = (typeof RACE_SEGMENT_KEYS)[number];

// Pipeline-tab decision outcome labels. Display-only (capitalised);
// distinct from the database DecisionOutcome enum. Covers both hiring
// and promotion modes — the Mirror's Decisions panel uses whichever
// label is appropriate for the meeting's mode (see
// decision-display.ts).
export type MirrorDecisionOutcome =
  | 'Hired'
  | 'Declined'
  | 'Pending'
  | 'Promoted'
  | 'Held';

export interface MirrorManager {
  name: string;
  team: string;
  initials: string;
}

export interface MirrorSummary {
  interviewsCount: number;
  rolesCount: number;
  topCategory: string;          // human label from FLAG_TYPE_LABELS
  topCategoryCount: number;
  avgFlagsPerInterview: number;
  dismissedFlags: number;
  totalFlags: number;
}

export interface MirrorDecision {
  id: string;
  date: string;                 // human-friendly, e.g. 'May 18'
  candidate: string;            // given name
  surname: string;
  role: string;
  flags: number;
  outcome: MirrorDecisionOutcome;
  daysAgo: number;
}

// Pipeline row carries a segments map (Race | 'unknown' → count) rather
// than a represented/majority binary. See Section 3 of the Week 4 plan.
export interface PipelineRow {
  stage: string;                // 'Applied' | 'Interviewed' | 'Hired' | 'Rejected'
  segments: Record<RaceSegmentKey, number>;
  total: number;
}

// Language tab row. delta is null when the prior window has fewer than
// the sparse threshold of flags; UI renders a neutral pip instead of an
// arrow. See Section 2 of the Week 4 plan.
export interface LanguageFlagRow {
  id: FlagType;                 // enum key
  label: string;                // FLAG_TYPE_LABELS[id]
  count: number;
  delta: number | null;
  highlight?: boolean;
}

export interface MirrorNudge {
  id: string;
  tag: string;                  // small italic label, e.g. 'Language · self-pattern'
  sentence: string;
  linkTo?: string;
}

export interface MirrorData {
  manager: MirrorManager;
  period: string;               // display label for the selector
  periodKey: MirrorPeriod;      // canonical key
  periodOptions: string[];
  summary: MirrorSummary;
  decisions: MirrorDecision[];
  recentDecisions: MirrorDecision[];
  pipeline: PipelineRow[];
  languageFlags: LanguageFlagRow[];
  nudges: MirrorNudge[];
}
