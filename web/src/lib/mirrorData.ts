// Mock data for the Pattern Mirror screen — used until the backend can
// produce the aggregates the design calls for (per-manager flag-category
// counts with period deltas, pipeline composition by represented vs majority
// background, decision velocity over 90d). Replace with a real adapter when
// those endpoints land; the exported types are the contract.

export type DecisionOutcome = 'Hired' | 'Advanced' | 'Declined' | 'Pending';

export interface MirrorDecision {
  id: string;
  date: string;            // human-friendly, e.g. 'May 18'
  candidate: string;       // given name
  surname: string;
  role: string;
  flags: number;
  outcome: DecisionOutcome;
  daysAgo: number;         // 0 = today
}

// Race-segment keys for the Demographics pipeline. Mirrors the
// canonical RACE_SEGMENT_KEYS in @fairhire/shared (kept local here so
// the mock and chart can compile without depending on shared mid-step).
export type RaceSegmentKey = 'chinese' | 'malay' | 'indian' | 'other' | 'unknown';

export const RACE_SEGMENT_KEYS: readonly RaceSegmentKey[] = [
  'chinese',
  'malay',
  'indian',
  'other',
  'unknown',
] as const;

export interface PipelineRow {
  stage: string;
  // Per-segment headcount for this stage. Unknown captures candidates
  // whose demographics row is missing or whose race field is null —
  // bucketed transparently rather than silently dropped.
  segments: Record<RaceSegmentKey, number>;
  total: number;
}

export interface LanguageFlagRow {
  id: string;
  label: string;
  count: number;
  // null when the prior comparison window has too few flags for a delta
  // to be meaningful (see DELTA_PRIOR_WINDOW_MIN_FLAGS in shared). UI
  // renders a neutral pip instead of an arrow for null.
  delta: number | null;
  highlight?: boolean;
}

export interface MirrorNudge {
  id: string;
  tag: string;             // small italic label, e.g. 'Language · self-pattern'
  sentence: string;        // editorial pull-quote body
  linkTo?: string;         // optional CTA target (display only in mock)
}

export interface MirrorSummary {
  interviewsCount: number;
  rolesCount: number;
  topCategory: string;
  topCategoryCount: number;
  avgFlagsPerInterview: number;
  dismissedFlags: number;
  totalFlags: number;
}

export interface MirrorManager {
  name: string;
  team: string;
  initials: string;
}

export interface MirrorData {
  manager: MirrorManager;
  period: string;
  periodOptions: string[];
  summary: MirrorSummary;
  decisions: MirrorDecision[];
  recentDecisions: MirrorDecision[];
  pipeline: PipelineRow[];
  languageFlags: LanguageFlagRow[];
  nudges: MirrorNudge[];
}

// Deterministic PRNG so re-renders don't reshuffle the synthetic decisions.
function lcg(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const ROLES = [
  'Associate Analyst',
  'Senior Analyst',
  'Associate',
  'Associate Director',
  'Director',
];
const NAMES: Array<[string, string]> = [
  ['Ahmad', 'Faris'], ['Siti', 'Nurhaliza'], ['Rajesh', 'Kumar'],
  ['Mei Ling', 'Chua'], ['Kevin', 'Tan'], ['Lakshmi', 'Krishnamurthy'],
  ['Muhammad', 'Azri'], ['Ravi', 'Shankar'], ['Nurul', 'Izzah'],
  ['Hannah', 'Lim'], ['Wei Liang', 'Tan'], ['Priya', 'Patel'],
  ['Daniel', 'Whittaker'], ['Aisha', 'Hassan'], ['Marcus', 'Chen'],
];

function generateDecisions(count: number): MirrorDecision[] {
  const rand = lcg(20260530);
  const out: MirrorDecision[] = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(rand() * 90);
    const flagsRoll = rand();
    const flags = flagsRoll < 0.1 ? 0 : flagsRoll < 0.55 ? 1 + Math.floor(rand() * 3) : 4 + Math.floor(rand() * 5);
    const [given, surname] = NAMES[Math.floor(rand() * NAMES.length)];
    const role = ROLES[Math.floor(rand() * ROLES.length)];
    const outcomeRoll = rand();
    const outcome: DecisionOutcome =
      outcomeRoll < 0.2 ? 'Hired' :
      outcomeRoll < 0.5 ? 'Advanced' :
      outcomeRoll < 0.85 ? 'Declined' : 'Pending';
    out.push({
      id: `dec-${i + 1}`,
      date: dateLabel(daysAgo),
      candidate: given,
      surname,
      role,
      flags,
      outcome,
      daysAgo,
    });
  }
  return out.sort((a, b) => a.daysAgo - b.daysAgo);
}

function dateLabel(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

const decisions = generateDecisions(47);

export const mirrorData: MirrorData = {
  manager: {
    name: 'Daniel Whittaker',
    team: 'Group Strategy & Sustainability',
    initials: 'DW',
  },
  period: 'Last 90 days',
  periodOptions: ['Last 30 days', 'Last 90 days', 'Last 12 months'],
  summary: {
    interviewsCount: decisions.length,
    rolesCount: new Set(decisions.map((d) => d.role)).size,
    topCategory: 'Energy / pace language',
    topCategoryCount: 12,
    avgFlagsPerInterview: Number(
      (decisions.reduce((s, d) => s + d.flags, 0) / decisions.length).toFixed(1),
    ),
    dismissedFlags: 18,
    totalFlags: decisions.reduce((s, d) => s + d.flags, 0),
  },
  decisions,
  recentDecisions: decisions.slice(0, 8),
  // Mock funnel uses the 4 stages the schema actually models (Section 3
  // of the Week 4 plan) and shows race composition per stage.
  pipeline: [
    {
      stage: 'Applied',
      segments: { chinese: 488, malay: 168, indian: 96, other: 28, unknown: 20 },
      total: 800,
    },
    {
      stage: 'Interviewed',
      segments: { chinese: 138, malay: 38, indian: 14, other: 4, unknown: 2 },
      total: 196,
    },
    {
      stage: 'Hired',
      segments: { chinese: 18, malay: 5, indian: 2, other: 1, unknown: 0 },
      total: 26,
    },
    {
      stage: 'Rejected',
      segments: { chinese: 80, malay: 22, indian: 8, other: 2, unknown: 1 },
      total: 113,
    },
  ],
  languageFlags: [
    { id: 'age-tone',         label: 'Energy / pace language',          count: 12, delta:  4, highlight: true },
    { id: 'culture-fit',      label: '"Culture fit" without evidence',  count:  9, delta: -1 },
    { id: 'career-stage',     label: 'Career-stage framing',            count:  7, delta:  2 },
    { id: 'communication',    label: 'Communication gap framing',       count:  6, delta:  0 },
    { id: 'family-planning',  label: 'Family-planning references',      count:  4, delta: -2 },
    { id: 'accent-phrasing',  label: 'Accent / phrasing concerns',      count:  3, delta:  1 },
    { id: 'team-dynamic',     label: 'Vague team-dynamic concerns',     count:  3, delta:  0 },
    { id: 'school-calendar',  label: 'Schedule / availability framing', count:  2, delta:  0 },
  ],
  nudges: [
    {
      id: 'n1',
      tag: 'Language · self-pattern',
      sentence:
        'Energy and pace appear in your notes three times as often for candidates over 40. Worth asking whether the same evidence would surface for younger candidates.',
      linkTo: 'Language',
    },
    {
      id: 'n2',
      tag: 'Pipeline · representation',
      sentence:
        'Represented candidates drop off most sharply between Screened and Interviewed — a 12-point gap that hasn’t closed in the last quarter.',
      linkTo: 'Demographics',
    },
    {
      id: 'n3',
      tag: 'Decisions · velocity',
      sentence:
        'Your fastest-to-decision interviews this quarter were the ones where you flagged the most — a pattern worth watching for confirmation bias.',
      linkTo: 'Decisions',
    },
    {
      id: 'n4',
      tag: 'Language · self-pattern',
      sentence:
        '"Culture fit" without a behavioural example shows up in nine recent interviews. Defining it once for the role would make decisions more auditable.',
    },
    {
      id: 'n5',
      tag: 'Pipeline · representation',
      sentence:
        'The gap between Offered and Hired is steady — your conversion at the final stage is the same for represented and majority candidates.',
    },
  ],
};
