import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import { transcripts } from './seed-transcripts';

type DemographicsSpec = Omit<
  Prisma.CandidateDemographicsCreateWithoutCandidateInput,
  'orgId'
>;

type CandidateSpec = {
  name: string;
  roleAppliedFor: string;
  demographics: DemographicsSpec;
};

// Use DIRECT_URL (superuser) so RLS does not block seed writes.
//
// DIRECT_URL points at Supabase's session-mode pooler (port 5432), which caps
// total clients at 15 — shared with any running dev:api server. Prisma's default
// pool is `cpus × 2 + 1` (~17 here), so the parallel Promise.all / createMany
// bursts below can open enough connections at once to trip EMAXCONNSESSION on
// their own. Pin this client's pool to 1: the bursts just queue over a single
// connection (a few seconds slower, immune to the pooler cap).
const seedUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';
const seedUrlWithLimit = seedUrl.includes('?')
  ? `${seedUrl}&connection_limit=1`
  : `${seedUrl}?connection_limit=1`;

const prisma = new PrismaClient({
  datasources: { db: { url: seedUrlWithLimit } },
});

async function main() {
  console.log('[seed] Clearing existing data...');

  await prisma.analysisRun.deleteMany();
  await prisma.flag.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.meetingCandidate.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.candidateDemographics.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.manager.deleteMany();
  await prisma.department.deleteMany();
  await prisma.organisation.deleteMany();

  // ─── Organisation + Department ──────────────────────────────────────────────

  console.log('[seed] Creating organisation and department...');

  const org = await prisma.organisation.create({
    data: { name: 'Meridian Capital Partners' },
  });

  // Several divisions so the account page's division picker is meaningful.
  // The seed managers below all live in Investment Banking (departments[0]);
  // they can move themselves between these from the Workspace settings page.
  const departmentNames = [
    'Investment Banking',
    'Global Markets',
    'Wealth Management',
    'Asset Management',
    'Group Technology',
    'Risk & Compliance',
  ];
  const departments = await Promise.all(
    departmentNames.map((name) =>
      prisma.department.create({ data: { orgId: org.id, name } }),
    ),
  );
  const dept = departments[0]!; // Investment Banking — the managers' home division

  // ─── Managers ───────────────────────────────────────────────────────────────

  console.log('[seed] Creating managers...');

  const [wei, priya, david, marcus] = await Promise.all([
    prisma.manager.create({
      data: {
        clerkUserId: 'seed_user_wei_liang_tan',
        orgId: org.id,
        deptId: dept.id,
        role: 'manager',
        name: 'Wei Liang Tan',
        email: 'wei.tan@meridian-capital.sg',
      },
    }),
    prisma.manager.create({
      data: {
        // Doubles as the public demo manager (landing page "Explore the demo →
        // hiring manager"). Priya's asymmetric_concern pattern gives visitors a
        // real Decision Companion + Pattern Mirror to explore.
        clerkUserId: 'user_3G7mxVcEJwU6zczguUzm8NlZPux',
        orgId: org.id,
        deptId: dept.id,
        role: 'manager',
        name: 'Priya Nair',
        email: 'priya.nair@meridian-capital.sg',
      },
    }),
    prisma.manager.create({
      data: {
        clerkUserId: 'seed_user_david_lim',
        orgId: org.id,
        deptId: dept.id,
        role: 'manager',
        name: 'David Lim',
        email: 'david.lim@meridian-capital.sg',
      },
    }),
    prisma.manager.create({
      data: {
        clerkUserId: 'seed_user_marcus_chen',
        orgId: org.id,
        deptId: dept.id,
        role: 'manager',
        name: 'Marcus Chen',
        email: 'marcus.chen@meridian-capital.sg',
      },
    }),
  ]);

  await prisma.manager.create({
    data: {
      clerkUserId: 'seed_user_sarah_wong',
      orgId: org.id,
      deptId: dept.id,
      role: 'hr_admin',
      name: 'Sarah Wong',
      email: 'sarah.wong@meridian-capital.sg',
    },
  });

  // Public demo HR account — powers the landing page's "Explore the demo →
  // Enter as HR". A second hr_admin in the same org with no meetings/flags/
  // decisions of its own, so it adds nothing to the org aggregates; it simply
  // sees the same anonymised HR Overview. Dedicated Clerk account, separate
  // from Sarah so a visitor never lands in the presenter's HR session.
  await prisma.manager.create({
    data: {
      clerkUserId: 'user_3G7mxVxKa8jRrf8erJ1SUFU7xHJ',
      orgId: org.id,
      deptId: dept.id,
      role: 'hr_admin',
      name: 'Demo — HR Analytics',
      email: 'demo.hr+clerk_test@example.com',
    },
  });

  // ─── Candidates ─────────────────────────────────────────────────────────────

  console.log('[seed] Creating candidates...');

  const candidateSpecs: CandidateSpec[] = [
    {
      name: 'Ahmad Faris bin Ismail',
      roleAppliedFor: 'Associate Analyst',
      demographics: {
        nationalityStatus: 'ep_holder',
        race: 'malay',
        ageBand: 'age_30_39',
        gender: 'male',
        firstLanguage: 'Malay',
        yearsInSingapore: 4,
      },
    },
    {
      name: 'Siti Nurhaliza bte Rahman',
      roleAppliedFor: 'Analyst',
      demographics: {
        nationalityStatus: 'citizen',
        race: 'malay',
        ageBand: 'under_30',
        gender: 'female',
        university: 'NUS',
        major: 'Finance',
      },
    },
    {
      name: 'Rajesh Kumar s/o Subramaniam',
      roleAppliedFor: 'Senior Analyst',
      demographics: {
        nationalityStatus: 'pr',
        race: 'indian',
        ageBand: 'age_40_49',
        gender: 'male',
        previousEmployer: 'Deloitte Transactions',
      },
    },
    {
      name: 'Mei Ling Chua',
      roleAppliedFor: 'Associate',
      demographics: {
        nationalityStatus: 'citizen',
        race: 'chinese',
        ageBand: 'age_30_39',
        gender: 'female',
        previousEmployer: 'Goldman Sachs IBD',
      },
    },
    {
      name: 'Kevin Tan Wei Jie',
      roleAppliedFor: 'Analyst',
      demographics: {
        nationalityStatus: 'citizen',
        race: 'chinese',
        ageBand: 'under_30',
        gender: 'male',
        university: 'NTU',
        major: 'Accountancy',
      },
    },
    {
      name: 'Lakshmi d/o Krishnamurthy',
      roleAppliedFor: 'Director',
      demographics: {
        nationalityStatus: 'ep_holder',
        race: 'indian',
        ageBand: 'age_50_plus',
        gender: 'female',
        yearsExperience: 22,
        currentBase: 'Hong Kong',
      },
    },
    {
      name: 'Muhammad Azri bin Abdullah',
      roleAppliedFor: 'Associate',
      demographics: {
        nationalityStatus: 's_pass',
        race: 'malay',
        ageBand: 'age_30_39',
        gender: 'male',
        firstLanguage: 'Malay',
        currentBase: 'Kuala Lumpur',
      },
    },
    {
      name: 'Jennifer Lee Hui Ying',
      roleAppliedFor: 'Vice President',
      demographics: {
        nationalityStatus: 'pr',
        race: 'chinese',
        ageBand: 'age_40_49',
        gender: 'female',
        previousEmployer: 'UBS Investment Bank',
      },
    },
    {
      name: 'Ravi Shankar s/o Pillai',
      roleAppliedFor: 'Director',
      demographics: {
        nationalityStatus: 'citizen',
        race: 'indian',
        ageBand: 'age_50_plus',
        gender: 'male',
        yearsExperience: 28,
        previousEmployer: 'CIMB Investment Banking',
      },
    },
    {
      name: 'Nurul Izzah bte Kamaruddin',
      roleAppliedFor: 'Associate Director',
      demographics: {
        nationalityStatus: 'citizen',
        race: 'malay',
        ageBand: 'age_40_49',
        gender: 'female',
        yearsExperience: 14,
        previousEmployer: 'Maybank Investment Banking',
      },
    },
  ];

  // Nested create writes each candidate and its 1:1 demographics row in one
  // atomic operation — no separate createMany, and no index-based pairing
  // between two arrays to keep aligned. demographics.orgId is derived by
  // Prisma from the parent candidate via the composite FK, so we don't (and
  // can't) pass it here.
  const candidates = await Promise.all(
    candidateSpecs.map((spec) =>
      prisma.candidate.create({
        data: {
          orgId: org.id,
          name: spec.name,
          roleAppliedFor: spec.roleAppliedFor,
          demographics: { create: { ...spec.demographics } },
        },
      }),
    ),
  );

  const [ahmad, siti, rajesh, meiLing, kevin, lakshmi, azri, , ravi, nurul] = candidates;

  // ─── Meetings ────────────────────────────────────────────────────────────────

  console.log('[seed] Creating meetings...');

  // All timestamps below are anchored to the moment the seed runs, not to fixed
  // calendar dates. Hard-coded dates silently age out of the dashboards' rolling
  // windows — the Pattern Mirror and HR Overview both default to "Last 90 days",
  // so a seed dated months back renders every analytics view empty. Ten meetings
  // land in the current 90-day window (so those views are populated on a fresh
  // demo); m7 and m9 sit in the *prior* window so the period-over-period deltas
  // are non-empty. The prior window deliberately carries only asymmetric_concern
  // and hedging_language flags — no criteria_drift — so no type both clears the
  // surge count floor AND has a non-zero prior baseline, which keeps the HR nudge
  // set deterministic (composition-shift + dominant-category + dismissal-rate).
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const [
    m1, m2, m3, m4,
    m5, m6, m7, m8,
    m9, m10, m11,
    m12,
  ] = await Promise.all([
    // Wei Liang Tan — criteria_drift pattern
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: wei.id,
        title: 'Associate Analyst Interview — Ahmad Faris',
        transcript: transcripts.wei_ahmad,
        date: daysAgo(82), // current window
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: wei.id,
        title: 'Senior Analyst Interview — Rajesh Kumar',
        transcript: transcripts.wei_rajesh,
        date: daysAgo(70), // current window
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: wei.id,
        title: 'Associate Interview — Muhammad Azri',
        transcript: transcripts.wei_muhammad,
        date: daysAgo(60), // current window
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: wei.id,
        title: 'Analyst Interview — Kevin Tan',
        transcript: transcripts.wei_kevin,
        date: daysAgo(36), // current window — Kevin hired (composition-shift)
      },
    }),
    // Priya Nair — asymmetric_concern pattern
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: priya.id,
        title: 'Analyst Interview — Siti Nurhaliza',
        transcript: transcripts.priya_siti,
        date: daysAgo(78), // current window
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: priya.id,
        title: 'Associate Director Interview — Nurul Izzah',
        transcript: transcripts.priya_nurul,
        date: daysAgo(52), // current window
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: priya.id,
        title: 'Director Interview — Lakshmi Krishnamurthy',
        transcript: transcripts.priya_lakshmi,
        date: daysAgo(105), // PRIOR window (feeds delta, not surge)
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: priya.id,
        title: 'Associate Interview — Mei Ling Chua',
        transcript: transcripts.priya_mei_ling,
        date: daysAgo(20), // current window — Mei Ling hired (composition-shift)
      },
    }),
    // David Lim — hedging_language + age_bias pattern
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: david.id,
        title: 'Senior Analyst 2nd Round — Rajesh Kumar',
        transcript: transcripts.david_rajesh,
        date: daysAgo(125), // PRIOR window (feeds delta, not surge)
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: david.id,
        title: 'Director Interview — Ravi Shankar',
        transcript: transcripts.david_ravi,
        date: daysAgo(44), // current window
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: david.id,
        title: 'Director 2nd Round — Lakshmi Krishnamurthy',
        transcript: transcripts.david_lakshmi,
        date: daysAgo(28), // current window
      },
    }),
    // Marcus Chen — clean
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: marcus.id,
        title: 'Analyst Final Round — Kevin Tan',
        transcript: transcripts.marcus_kevin,
        date: daysAgo(10), // current window — Kevin hired (composition-shift)
      },
    }),
  ]);

  // ─── Promotion-mode meetings (Wei Liang Tan) ─────────────────────────────────
  // Gives the Promotion surface real data to demo. Reuses EXISTING candidates as
  // promotion targets (no new candidate rows), so the HR demographic pool — and
  // with it the composition-shift nudge — is unchanged; promotion decisions
  // (held/in_progress) are excluded from the hired/rejected demographic math too.
  // All three sit in the current 90-day window so Wei's Promotion Mirror is
  // populated. Flags (below) lean on confidence_proxy — the presence/gravitas
  // analogue of Wei's hiring criteria_drift — kept under the HR nudge floors so
  // the org-level hiring nudges stay put. The Mirror aggregates by mode, so
  // these never mix into Wei's hiring surface.
  const jennifer = candidates[7]!; // Jennifer Lee — not linked to any hiring meeting

  // Promotion targets carry current role + tenure so the Promotion companion
  // header renders them (mirrors the candidate.update the /meetings POST does).
  await Promise.all([
    prisma.candidate.update({
      where: { id: jennifer.id },
      data: { currentRole: 'Vice President', tenureYears: 6, lastPromotedAt: daysAgo(760) },
    }),
    prisma.candidate.update({
      where: { id: siti.id },
      data: { currentRole: 'Analyst', tenureYears: 3, lastPromotedAt: daysAgo(410) },
    }),
    prisma.candidate.update({
      where: { id: nurul.id },
      data: { currentRole: 'Associate Director', tenureYears: 9, lastPromotedAt: daysAgo(900) },
    }),
  ]);

  const [m13, m14, m15] = await Promise.all([
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: wei.id,
        meetingType: 'promotion',
        title: 'Promotion Review — Jennifer Lee (VP → MD)',
        transcript: transcripts.wei_promo_jennifer,
        date: daysAgo(55), // current window
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: wei.id,
        meetingType: 'promotion',
        title: 'Promotion Review — Siti Nurhaliza (Analyst → Senior Analyst)',
        transcript: transcripts.wei_promo_siti,
        date: daysAgo(33), // current window
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: wei.id,
        meetingType: 'promotion',
        title: 'Promotion Review — Nurul Izzah (Associate Director → Director)',
        transcript: transcripts.wei_promo_nurul,
        date: daysAgo(16), // current window
      },
    }),
  ]);

  // ─── Meeting ↔ Candidate links ───────────────────────────────────────────────

  console.log('[seed] Linking candidates to meetings...');

  await prisma.meetingCandidate.createMany({
    data: [
      { meetingId: m1.id, candidateId: ahmad.id },
      { meetingId: m2.id, candidateId: rajesh.id },
      { meetingId: m3.id, candidateId: azri.id },
      { meetingId: m4.id, candidateId: kevin.id },
      { meetingId: m5.id, candidateId: siti.id },
      { meetingId: m6.id, candidateId: nurul.id },
      { meetingId: m7.id, candidateId: lakshmi.id },
      { meetingId: m8.id, candidateId: meiLing.id },
      { meetingId: m9.id, candidateId: rajesh.id },
      { meetingId: m10.id, candidateId: ravi.id },
      { meetingId: m11.id, candidateId: lakshmi.id },
      { meetingId: m12.id, candidateId: kevin.id },
      // Promotion reviews (Wei)
      { meetingId: m13.id, candidateId: jennifer.id },
      { meetingId: m14.id, candidateId: siti.id },
      { meetingId: m15.id, candidateId: nurul.id },
    ],
  });

  // ─── Decisions ───────────────────────────────────────────────────────────────

  console.log('[seed] Creating decisions...');

  await prisma.decision.createMany({
    data: [
      {
        orgId: org.id,
        meetingId: m1.id,
        candidateId: ahmad.id,
        managerId: wei.id,
        outcome: 'rejected',
        notes: 'Technical skills adequate but communication concerns are disqualifying for client-facing work.',
      },
      {
        orgId: org.id,
        meetingId: m2.id,
        candidateId: rajesh.id,
        managerId: wei.id,
        outcome: 'rejected',
        notes: 'Strong technical background but communication style needs significant improvement.',
      },
      {
        orgId: org.id,
        meetingId: m3.id,
        candidateId: azri.id,
        managerId: wei.id,
        outcome: 'in_progress',
        notes: 'Hold pending second panel opinion.',
      },
      {
        orgId: org.id,
        meetingId: m4.id,
        candidateId: kevin.id,
        managerId: wei.id,
        outcome: 'hired',
        notes: 'Strongest analyst candidate this cycle. Moving to offer.',
      },
      {
        orgId: org.id,
        meetingId: m5.id,
        candidateId: siti.id,
        managerId: priya.id,
        outcome: 'in_progress',
        notes: 'Need to confirm availability expectations before progressing.',
      },
      {
        orgId: org.id,
        meetingId: m6.id,
        candidateId: nurul.id,
        managerId: priya.id,
        outcome: 'rejected',
        notes: 'Availability commitment cannot be confirmed for this seat.',
      },
      {
        orgId: org.id,
        meetingId: m7.id,
        candidateId: lakshmi.id,
        managerId: priya.id,
        outcome: 'rejected',
        notes: 'Travel and availability requirements cannot be met.',
      },
      {
        orgId: org.id,
        meetingId: m8.id,
        candidateId: meiLing.id,
        managerId: priya.id,
        outcome: 'hired',
        notes: 'Exceptional candidate from Goldman. Moving to partner round immediately.',
      },
      {
        orgId: org.id,
        meetingId: m9.id,
        candidateId: rajesh.id,
        managerId: david.id,
        outcome: 'rejected',
        notes: 'Culture fit concerns override technical adequacy.',
      },
      {
        orgId: org.id,
        meetingId: m10.id,
        candidateId: ravi.id,
        managerId: david.id,
        outcome: 'rejected',
        notes: 'Experience depth noted but pace and energy fit is a concern.',
      },
      {
        orgId: org.id,
        meetingId: m11.id,
        candidateId: lakshmi.id,
        managerId: david.id,
        outcome: 'rejected',
        notes: 'Energy and culture fit concerns are deciding factors.',
      },
      {
        orgId: org.id,
        meetingId: m12.id,
        candidateId: kevin.id,
        managerId: marcus.id,
        outcome: 'hired',
        notes: 'Unanimous hire. Progressing to offer.',
      },
      // Promotion decisions (Wei) — held/in_progress are outside the
      // hired/rejected demographic aggregate, so the composition nudge is safe.
      {
        orgId: org.id,
        meetingId: m13.id,
        candidateId: jennifer.id,
        managerId: wei.id,
        outcome: 'held',
        notes: 'Strong performer; held this cycle on presence. Revisit at next committee.',
      },
      {
        orgId: org.id,
        meetingId: m14.id,
        candidateId: siti.id,
        managerId: wei.id,
        outcome: 'in_progress',
        notes: 'Revisit once she has led a live process end to end.',
      },
      {
        orgId: org.id,
        meetingId: m15.id,
        candidateId: nurul.id,
        managerId: wei.id,
        outcome: 'held',
        notes: 'Strong operator; held on Director-level presence.',
      },
    ],
  });

  // ─── Flags ───────────────────────────────────────────────────────────────────

  console.log('[seed] Creating flags...');

  // Wei Liang Tan — criteria_drift (meetings 1–3, no flags on meeting 4)
  await prisma.flag.createMany({
    data: [
      {
        orgId: org.id,
        meetingId: m1.id,
        flagType: 'criteria_drift',
        excerpt: "The candidate's verbal delivery was at times difficult to follow.",
        reasoning:
          'Language competency concerns raised in isolation for a non-native English speaking candidate. No equivalent concern noted in comparable Chinese candidate reviews this period.',
        confidenceScore: 0.91,
        suggestedAlt:
          'Evaluate on specific presentation skills rubric (clarity, structure, pacing) applied consistently to all candidates.',
      },
      {
        orgId: org.id,
        meetingId: m1.id,
        flagType: 'criteria_drift',
        excerpt: 'For a client-facing Associate role, clear and confident English communication is critical.',
        reasoning:
          'English communication raised as a decisive criterion specifically following interview of a Malay/EP holder candidate. This criterion was not mentioned in notes for non-minority candidates.',
        confidenceScore: 0.92,
        suggestedAlt:
          'If communication is a key criterion, define it with specific observable behaviours and apply it consistently across all candidate notes.',
      },
      {
        orgId: org.id,
        meetingId: m1.id,
        flagType: 'criteria_drift',
        excerpt: 'The team would struggle to follow him in high-pressure deal environments.',
        reasoning:
          'Assumption that the team would struggle to follow this candidate made without reference to specific communication errors. Pattern of similar assumptions concentrated on non-native English speaking candidates.',
        confidenceScore: 0.88,
        suggestedAlt:
          'Note specific instances where communication caused confusion rather than making a general assumption about team reception.',
      },
      {
        orgId: org.id,
        meetingId: m1.id,
        flagType: 'criteria_drift',
        excerpt: 'Accent and phrasing may also be a concern when presenting to external clients.',
        reasoning:
          "Explicit accent-based concern raised as disqualifying. Accent is not a job-relevant criterion. This language suggests the candidate's ethnicity or origin is the underlying concern rather than a specific communication deficiency.",
        confidenceScore: 0.95,
        suggestedAlt:
          'Remove accent as a criterion entirely. Focus on whether the candidate communicated the required information accurately and whether clients could understand the content.',
      },
      {
        orgId: org.id,
        meetingId: m2.id,
        flagType: 'criteria_drift',
        excerpt: 'Communication style felt indirect and hard to follow at times.',
        reasoning:
          'Communication concern raised without specific examples or comparison to a defined standard. Pattern consistent with criteria_drift when concentrated on Indian/minority candidates.',
        confidenceScore: 0.88,
        suggestedAlt:
          'Provide a concrete example of a moment in the interview where communication led to misunderstanding or inefficiency.',
      },
      {
        orgId: org.id,
        meetingId: m2.id,
        flagType: 'criteria_drift',
        excerpt: 'Would benefit from more polished English presentation before stepping into client-facing responsibilities.',
        reasoning:
          'The phrase "polished English" implies a standard tied to a particular dialect or accent rather than communication effectiveness. Not observed in notes for Chinese candidates at the same level.',
        confidenceScore: 0.85,
        suggestedAlt:
          "Specify the communication gap: was it pace, structure, vocabulary, or something else? This allows the candidate to improve on a defined standard rather than an ambiguous 'polish' metric.",
      },
      {
        orgId: org.id,
        meetingId: m2.id,
        flagType: 'criteria_drift',
        excerpt: 'Not sure client partners would connect well with his communication approach.',
        reasoning:
          'Vague prediction about client reception without any basis in observed client interaction. Concern raised specifically for an Indian candidate; not raised for candidates from majority demographic groups in this review cycle.',
        confidenceScore: 0.90,
        suggestedAlt:
          'If client communication is a concern, note the specific communication behaviour that prompted it and whether the candidate was given an opportunity to demonstrate client-facing communication in the interview.',
      },
      {
        orgId: org.id,
        meetingId: m2.id,
        flagType: 'criteria_drift',
        excerpt: 'His written work was solid, but I keep coming back to how he would sound on a live client call.',
        reasoning:
          'Spoken-communication concern introduced late as a decisive factor for a candidate whose written analysis was rated strong. No comparable note appears in reviews of majority-background candidates at this level this cycle.',
        confidenceScore: 0.84,
        suggestedAlt:
          'If client-call delivery matters, assess it directly with a short spoken exercise applied to every shortlisted candidate.',
      },
      {
        orgId: org.id,
        meetingId: m2.id,
        flagType: 'criteria_drift',
        excerpt: 'Would want to see clearer spoken English before we put him in front of clients.',
        reasoning:
          '"Clearer spoken English" is framed as a gating requirement, tied to accent rather than to a communication failure observed in the interview. Not applied to comparable candidates in this review set.',
        confidenceScore: 0.87,
        suggestedAlt:
          'Define the specific communication standard the role requires and record how each candidate was assessed against it.',
      },
      {
        orgId: org.id,
        meetingId: m3.id,
        flagType: 'criteria_drift',
        excerpt: 'A few figures were hard to catch during the walkthrough because of how he pronounces them.',
        reasoning:
          'Pronunciation raised as a substantive concern. Pronunciation is not a job-relevant criterion; the job-relevant question is whether the figures were communicated accurately and understood.',
        confidenceScore: 0.85,
        suggestedAlt:
          'Note whether the figures were actually correct and understood, rather than commenting on the candidate\'s pronunciation.',
      },
      {
        orgId: org.id,
        meetingId: m3.id,
        flagType: 'criteria_drift',
        excerpt: 'Delivery was sometimes unclear, especially during the live case walkthrough portion.',
        reasoning:
          'Language-based delivery concern raised for a Malay/S-Pass candidate. Criteria drift pattern: communication raised as a deciding factor disproportionately for candidates with non-Chinese backgrounds.',
        confidenceScore: 0.83,
        suggestedAlt:
          'Document the specific moment in the walkthrough where delivery was unclear and what information was lost as a result.',
      },
      {
        orgId: org.id,
        meetingId: m3.id,
        flagType: 'criteria_drift',
        excerpt: 'English fluency concerns noted for client pitches and internal presentations.',
        reasoning:
          'Fluency raised as a concern for a Malay candidate without comparable language notes in reviews of Chinese candidates with equivalent roles. Suggests inconsistent application of communication criteria.',
        confidenceScore: 0.89,
        suggestedAlt:
          'Define the fluency threshold required for this role and document how each candidate was assessed against it.',
      },
      {
        orgId: org.id,
        meetingId: m3.id,
        flagType: 'criteria_drift',
        excerpt: 'A language barrier could hinder effective team communication under pressure.',
        reasoning:
          'The phrase "language barrier" implies the candidate speaks a different language rather than having a communication style difference. This framing risks conflating ethnicity with communication deficiency.',
        confidenceScore: 0.86,
        suggestedAlt:
          'Describe the observed communication challenge specifically: was it vocabulary, structure, speed, or comprehension? Avoid framing that implies a language deficit not supported by evidence.',
        dismissed: true,
        dismissReason: 'Candidate acknowledged this as an area of active development; concern is noted but not pattern-forming on its own.',
        dismissedAt: daysAgo(58),
        dismissedBy: wei.id,
      },
    ],
  });

  // Priya Nair — asymmetric_concern (meetings 5–7, no flags on meeting 8)
  await prisma.flag.createMany({
    data: [
      {
        orgId: org.id,
        meetingId: m5.id,
        flagType: 'asymmetric_concern',
        excerpt: 'Asked about plans for starting a family given the demanding hours of this role.',
        reasoning:
          'Family planning question directed at a female candidate. This question was not asked of male candidates interviewed for equivalent roles. Family status is not a job-relevant criterion.',
        confidenceScore: 0.92,
        suggestedAlt:
          'Replace with a consistent availability question for all candidates: "This role requires frequent evening and weekend availability. Can you confirm you are able to meet this commitment?"',
      },
      {
        orgId: org.id,
        meetingId: m5.id,
        flagType: 'asymmetric_concern',
        excerpt: 'Questioned whether childcare arrangements would affect availability for overseas travel.',
        reasoning:
          'Childcare question asked of a female candidate only. Asking specifically about childcare implies an assumption about gender-based caregiving responsibilities not applied to male candidates.',
        confidenceScore: 0.88,
        suggestedAlt:
          'If travel availability is a requirement, state the specific travel expectations and ask all candidates equally whether they can meet them.',
      },
      {
        orgId: org.id,
        meetingId: m5.id,
        flagType: 'asymmetric_concern',
        excerpt: 'Raised whether weekend commitments would conflict with personal responsibilities.',
        reasoning:
          '"Personal responsibilities" used as a coded phrase for family/domestic duties, asked of a female candidate. Male candidates interviewed this week were not asked about personal commitments in relation to weekend availability.',
        confidenceScore: 0.85,
        suggestedAlt:
          'Ask all candidates the same structured availability question without reference to personal or family circumstances.',
      },
      {
        orgId: org.id,
        meetingId: m6.id,
        flagType: 'asymmetric_concern',
        excerpt: 'Raised concern about whether family responsibilities would affect availability for on-call deal support.',
        reasoning:
          'Family responsibility concerns raised as a material factor in the hiring decision for a female candidate. No comparable concern raised for male candidates with stated family commitments.',
        confidenceScore: 0.90,
        suggestedAlt:
          'Availability should be assessed through a standardised question about the role requirements, not through inference about family responsibilities.',
      },
      {
        orgId: org.id,
        meetingId: m6.id,
        flagType: 'asymmetric_concern',
        excerpt: 'Noted that given she has children, on-call expectations may need to be discussed in detail.',
        reasoning:
          'Whether a candidate has children is referenced as a reason to add conditions to an offer. Parenthood status is not raised in equivalent male candidate notes.',
        confidenceScore: 0.87,
        suggestedAlt:
          'On-call expectations should be communicated to all candidates equally in writing as part of the role description, not surfaced selectively based on perceived family status.',
      },
      {
        orgId: org.id,
        meetingId: m6.id,
        flagType: 'asymmetric_concern',
        excerpt: 'Uncertain whether she would be fully available for urgent deal situations given her family commitments.',
        reasoning:
          'Availability doubt linked explicitly to family commitments for a female candidate. This assumption led to a rejection without the candidate being given an opportunity to confirm availability directly.',
        confidenceScore: 0.93,
        suggestedAlt:
          'Ask the candidate directly whether they can meet the availability requirements rather than making assumptions based on family status.',
        dismissed: true,
        dismissReason: 'Candidate herself raised schedule flexibility as a requirement early in the interview.',
        dismissedAt: daysAgo(50),
        dismissedBy: priya.id,
      },
      {
        orgId: org.id,
        meetingId: m7.id,
        flagType: 'asymmetric_concern',
        excerpt: 'Explored availability concerns given likely personal commitments at this life stage.',
        reasoning:
          '"Life stage" used as a proxy for family responsibilities without any evidence from the candidate. Age combined with gender used to infer caregiving duties that were never stated by the candidate.',
        confidenceScore: 0.91,
        suggestedAlt:
          'Do not infer personal commitments from age or gender. Ask all candidates the same availability question.',
      },
      {
        orgId: org.id,
        meetingId: m7.id,
        flagType: 'asymmetric_concern',
        excerpt: 'Questioned weekend availability and capacity for extended international travel.',
        reasoning:
          'Travel availability question is legitimate, but the framing in this note follows availability scrutiny concentrated exclusively on female candidates in this review cycle.',
        confidenceScore: 0.86,
        suggestedAlt:
          'Document travel requirements and whether the candidate confirmed or declined — without linking the question to other personal or demographic attributes.',
      },
      {
        orgId: org.id,
        meetingId: m7.id,
        flagType: 'asymmetric_concern',
        excerpt: 'Noted potential conflicts with family schedule when discussing deal timelines.',
        reasoning:
          "Reference to 'family schedule' conflicts noted as a factor in a Director-level rejection. No such notation in any male candidate's interview notes this quarter.",
        confidenceScore: 0.89,
        suggestedAlt:
          'Remove references to family schedule from interview notes. If scheduling was discussed, note what the candidate said about their availability directly.',
      },
    ],
  });

  // David Lim — hedging_language + age_bias (meetings 9–11)
  await prisma.flag.createMany({
    data: [
      {
        orgId: org.id,
        meetingId: m9.id,
        flagType: 'hedging_language',
        excerpt: 'Not sure about the cultural fit with our tightly-knit team dynamic.',
        reasoning:
          '"Cultural fit" invoked without any specific behavioural evidence. Pattern of cultural fit concerns concentrated on non-Chinese candidates across this manager\'s reviews.',
        confidenceScore: 0.83,
        suggestedAlt:
          'Replace with observable team behaviours: "Did the candidate demonstrate collaborative problem-solving? Did they ask questions that showed interest in how the team works?"',
      },
      {
        orgId: org.id,
        meetingId: m9.id,
        flagType: 'hedging_language',
        excerpt: "I'm uncertain whether Rajesh would integrate well with how we operate day-to-day.",
        reasoning:
          'Vague integration concern raised without specific evidence from the interview. No definition of "how we operate" provided to allow objective assessment.',
        confidenceScore: 0.86,
        suggestedAlt:
          'Define the team\'s working norms explicitly (e.g., direct feedback culture, paired review process) and note whether the candidate demonstrated alignment with those norms.',
      },
      {
        orgId: org.id,
        meetingId: m9.id,
        flagType: 'hedging_language',
        excerpt: 'The broader team may find it hard to gel with his working style and general approach.',
        reasoning:
          'Prediction about team reception made without evidence or structured team assessment. "Working style" used as a vague disqualifier concentrated on Indian/Malay candidates.',
        confidenceScore: 0.81,
        suggestedAlt:
          'If working style is a concern, describe a specific moment in the interview that illustrated the concern and explain the impact it would have on team output.',
      },
      {
        orgId: org.id,
        meetingId: m9.id,
        flagType: 'hedging_language',
        excerpt: 'Team interaction style might create friction in collaborative deal environments.',
        reasoning:
          'No evidence of friction observed in the interview. Prediction of future friction based on implicit assumptions rather than demonstrated behaviour.',
        confidenceScore: 0.78,
        suggestedAlt:
          'Note specific observable behaviours from the interview that suggest collaboration challenges, rather than predicting friction without evidence.',
      },
      {
        orgId: org.id,
        meetingId: m10.id,
        flagType: 'age_bias',
        excerpt: 'Not sure candidate has the energy needed for the pace of IB deal cycles.',
        reasoning:
          '"Energy" concern raised for a 50+ candidate without any observed evidence of low energy in the interview. Age_bias pattern: energy concerns concentrated on candidates aged 50 and above.',
        confidenceScore: 0.89,
        suggestedAlt:
          'Assess pace and stamina through structured questions about recent workload and deal timelines, applied consistently to all candidates.',
        dismissed: true,
        dismissReason: 'Reviewed with the panel — treated as a general observation about the desk, not a factor in the decision.',
        dismissedAt: daysAgo(42),
        dismissedBy: david.id,
      },
      {
        orgId: org.id,
        meetingId: m10.id,
        flagType: 'age_bias',
        excerpt: "Worried the role's intensity might not suit his current stage of career.",
        reasoning:
          '"Stage of career" used as a proxy for age. This language infers the candidate is past a peak rather than assessing their demonstrated capability and current work output.',
        confidenceScore: 0.91,
        suggestedAlt:
          "Focus on the candidate's current workload, recent transactions, and self-reported capacity rather than inferring from career stage.",
      },
      {
        orgId: org.id,
        meetingId: m10.id,
        flagType: 'age_bias',
        excerpt: 'Concerned about adaptability to newer analytical tools and workflows.',
        reasoning:
          'Technology adaptability concern raised for older candidate. While potentially valid, the concern was not framed as a specific gap observed in the interview but as a general assumption about age.',
        confidenceScore: 0.82,
        suggestedAlt: null,
        dismissed: true,
        dismissReason: 'Valid technical concern: candidate confirmed he had not used Bloomberg Terminal in two years and was unfamiliar with current data workflows. Not an age-based assumption.',
        dismissedAt: daysAgo(42),
        dismissedBy: david.id,
      },
      {
        orgId: org.id,
        meetingId: m10.id,
        flagType: 'age_bias',
        excerpt: 'Stamina and drive might be questioned by deal team leads during live transactions.',
        reasoning:
          'Stamina raised as a predictive concern for a 50+ candidate without any evidence of reduced stamina in the interview. Language implies the decision-making of others (deal team leads) would be biased, normalising that bias.',
        confidenceScore: 0.87,
        suggestedAlt:
          'If stamina in long deal cycles is a genuine concern, ask all candidates about their longest recent transaction and how they managed the workload. Do not predict team reaction based on candidate age.',
        dismissed: true,
        dismissReason: 'Panel agreed stamina was not actually evidenced in the interview; noted but set aside.',
        dismissedAt: daysAgo(42),
        dismissedBy: david.id,
      },
      {
        orgId: org.id,
        meetingId: m11.id,
        flagType: 'age_bias',
        excerpt: 'Energy levels and long-term commitment unclear for someone at this stage of career.',
        reasoning:
          '"Stage of career" again used as a proxy for age for a 50+ candidate. Energy and commitment doubted without evidence from the interview itself.',
        confidenceScore: 0.88,
        suggestedAlt:
          'Ask directly about long-term career goals and recent work intensity rather than inferring commitment from career stage.',
      },
      {
        orgId: org.id,
        meetingId: m11.id,
        flagType: 'hedging_language',
        excerpt: 'Cultural fit is a concern — the team may not easily connect with her background.',
        reasoning:
          '"Background" used in cultural fit context for an Indian female candidate. Pattern of cultural fit concerns concentrated on non-Chinese candidates across this manager\'s reviews.',
        confidenceScore: 0.84,
        suggestedAlt:
          'Specify what observable behaviours in the interview prompted the culture fit concern rather than referencing the candidate\'s background.',
      },
      {
        orgId: org.id,
        meetingId: m11.id,
        flagType: 'age_bias',
        excerpt: "The pace of the team might not align with where she is in her career trajectory.",
        reasoning:
          'Career trajectory used as coded language for age. Pace concern raised for a 50+ candidate without any evidence from the interview of pace mismatch.',
        confidenceScore: 0.86,
        suggestedAlt:
          'If pace is a concern, describe a specific moment in the interview (e.g., response time, analytical approach speed) that supports the assessment.',
        dismissed: true,
        dismissReason: 'Discussed and set aside; pace was not a deciding factor in the outcome.',
        dismissedAt: daysAgo(26),
        dismissedBy: david.id,
      },
      {
        orgId: org.id,
        meetingId: m11.id,
        flagType: 'hedging_language',
        excerpt: 'Fit with team\'s working culture and dynamic is uncertain without clear justification.',
        reasoning:
          'Interviewer acknowledges uncertainty without providing justification — yet this forms part of the rejection rationale. Pattern of unjustified culture fit rejections for non-Chinese and older candidates.',
        confidenceScore: 0.80,
        suggestedAlt:
          'Do not include unsubstantiated culture fit concerns in rejection rationale. Either provide observable behavioural evidence or remove the criterion from this decision.',
      },
    ],
  });

  // Marcus Chen — clean (no labelled flags). Earlier seed had 2 dismissed
  // sub-floor (conf 0.28 / 0.32) labels here — removed during calibration:
  // their excerpts were positive statements that didn't fit the assigned
  // flagTypes and structurally couldn't be matched by the engine.

  // Wei Liang Tan — promotion-mode flags. confidence_proxy is the dominant
  // pattern (presence/gravitas), the promotion-vocabulary echo of Wei's hiring
  // criteria_drift. Each excerpt is a verbatim substring of the matching
  // wei_promo_* transcript so FlagSpan offsets resolve. Per-type counts stay
  // below the HR nudge floors — each type < age_bias's current-window 7, and
  // none reaches the dismissal-rate min of 6 — so the org-level hiring nudges
  // (dominant-category, dismissal-rate, composition-shift) are unchanged. The
  // Mirror scopes by mode, so these surface only on the Promotion Mirror.
  await prisma.flag.createMany({
    data: [
      // m13 — Jennifer Lee (VP → MD)
      {
        orgId: org.id,
        meetingId: m13.id,
        flagType: 'confidence_proxy',
        excerpt: 'She needs more executive presence before we put her in front of the board.',
        reasoning:
          '"Executive presence" gates the decision without a specific, observable behaviour attached. Presence language disproportionately affects women and minorities and often proxies for style rather than capability.',
        confidenceScore: 0.9,
        suggestedAlt:
          'Name the board-facing behaviour required (e.g. leads the room on a live deal review) and assess it directly, rather than citing "presence".',
      },
      {
        orgId: org.id,
        meetingId: m13.id,
        flagType: 'peer_comparison_bias',
        excerpt: 'She is not as polished as Daniel was at the same point in his career.',
        reasoning:
          'Readiness is benchmarked against a single named peer rather than the Director-level rubric, importing that person\'s style as the standard.',
        confidenceScore: 0.88,
        suggestedAlt: 'Assess against the published level criteria, not against a specific colleague.',
      },
      {
        orgId: org.id,
        meetingId: m13.id,
        flagType: 'potential_vs_performance',
        excerpt: 'She clearly has a high ceiling, but I am not sure she is ready this cycle.',
        reasoning:
          'A strong demonstrated performance is discounted in favour of a subjective read on "ceiling" and readiness. Potential framing tends to advantage those who match a prototype.',
        confidenceScore: 0.78,
        suggestedAlt:
          'Anchor the decision on demonstrated results against the level bar rather than a projection of ceiling.',
      },
      // m14 — Siti Nurhaliza (Analyst → Senior Analyst)
      {
        orgId: org.id,
        meetingId: m14.id,
        flagType: 'confidence_proxy',
        excerpt: 'She lacks gravitas in front of clients.',
        reasoning:
          '"Gravitas" is an unspecified trait standing in for demonstrated client outcomes — a classic proxy that penalises quieter or non-prototypical styles.',
        confidenceScore: 0.85,
        suggestedAlt:
          'Point to a specific client interaction and what was missing, or assess measured client outcomes instead.',
      },
      {
        orgId: org.id,
        meetingId: m14.id,
        flagType: 'confidence_proxy',
        excerpt: 'She needs more presence when she presents to the desk.',
        reasoning:
          'Presence is cited as a development gap without a concrete, observable behaviour; the signal is about style, not the quality of the analysis being presented.',
        confidenceScore: 0.9,
        suggestedAlt:
          'Specify what "presence" means here (structure, pace, handling challenge) so it can be coached and assessed objectively.',
      },
      {
        orgId: org.id,
        meetingId: m14.id,
        flagType: 'confidence_proxy',
        excerpt: 'She is not assertive enough in the room when senior people push back.',
        reasoning:
          'Assertiveness is treated as a readiness criterion. Assertiveness feedback is applied unevenly by gender and can penalise sound analysis delivered without confrontation.',
        confidenceScore: 0.85,
        suggestedAlt:
          'Judge whether she defends her analysis with evidence when challenged, not how forceful the delivery is.',
      },
      {
        orgId: org.id,
        meetingId: m14.id,
        flagType: 'potential_vs_performance',
        excerpt: 'There is a lot of potential here, but the track record is still thin at the level.',
        reasoning:
          'Demonstrated technical strength is set aside in favour of a "potential" caveat; where the record is strong, potential framing can understate readiness.',
        confidenceScore: 0.88,
        suggestedAlt:
          'List the concrete deliverables expected at Senior Analyst and check them against her record.',
      },
      // m15 — Nurul Izzah (Associate Director → Director)
      {
        orgId: org.id,
        meetingId: m15.id,
        flagType: 'tenure_framing',
        excerpt: 'She has been here a long time and has earned her stripes.',
        reasoning:
          'Tenure ("earned her stripes") is offered as a rationale. Length of service is not a proxy for readiness at the next level and can mask a thin capability case.',
        confidenceScore: 0.88,
        suggestedAlt:
          'Separate tenure from readiness — evaluate current-level evidence against the Director rubric.',
      },
      {
        orgId: org.id,
        meetingId: m15.id,
        flagType: 'confidence_proxy',
        excerpt: 'She still needs more gravitas to hold the room with clients.',
        reasoning:
          '"Gravitas" again gates the decision without a specific behaviour — the same presence proxy recurring across this manager\'s promotion reviews.',
        confidenceScore: 0.9,
        suggestedAlt:
          'Define the client-facing behaviour required at Director and assess it on evidence, not "gravitas".',
      },
      {
        orgId: org.id,
        meetingId: m15.id,
        flagType: 'peer_comparison_bias',
        excerpt: 'Compared to Marcus, she is more tentative when the room gets difficult.',
        reasoning:
          'Readiness is benchmarked against a single named colleague rather than the level criteria, importing his style as the bar.',
        confidenceScore: 0.78,
        suggestedAlt: 'Compare against the Director-level rubric, not against a specific peer.',
      },
      {
        orgId: org.id,
        meetingId: m15.id,
        flagType: 'potential_vs_performance',
        excerpt: 'She could grow into the role over the next year with the right coaching on executive presence.',
        reasoning:
          'A "grow into the role" projection defers a decision the current record may already support, and pairs the deferral with a presence caveat.',
        confidenceScore: 0.85,
        suggestedAlt:
          'Decide on demonstrated Director-level evidence now; scope coaching separately from the readiness call.',
      },
    ],
  });

  // ─── Analysis runs ────────────────────────────────────────────────────────────

  console.log('[seed] Creating analysis runs...');

  // Every meeting gets its own completed run so the Flag Review screen always
  // resolves to a terminal state. A meeting with no AnalysisRun (or a stuck
  // 'pending' one) is read by the client as status 'pending' — dataAdapter's
  // `run?.status ?? 'pending'` — which spins the "Analysing…" poller forever
  // and never reveals the flags already in the DB. So: one completed run per
  // meeting, anchored to that meeting's date. Marcus's m12 has zero flags → it
  // shows the clean "No flags raised" empty state; the rest reveal their flags.
  const runDurationsMs: [{ id: string; date: Date }, number][] = [
    [m1, 47_000], [m2, 39_000], [m3, 44_000], [m4, 51_000],
    [m5, 53_000], [m6, 42_000], [m7, 38_000], [m8, 49_000],
    [m9, 55_000], [m10, 46_000], [m11, 40_000], [m12, 41_000],
    [m13, 45_000], [m14, 43_000], [m15, 50_000], // promotion reviews (Wei)
  ];

  await prisma.analysisRun.createMany({
    data: runDurationsMs.map(
      ([m, durationMs]): Prisma.AnalysisRunCreateManyInput => ({
        orgId: org.id,
        meetingId: m.id,
        status: 'completed',
        modelVersion: 'claude-3-5-sonnet-20241022',
        startedAt: m.date,
        completedAt: new Date(m.date.getTime() + durationMs),
      }),
    ),
  });

  // ─── Summary ─────────────────────────────────────────────────────────────────

  const [orgCount, mgrCount, candidateCount, meetingCount, decisionCount, flagCount, runCount] =
    await Promise.all([
      prisma.organisation.count(),
      prisma.manager.count(),
      prisma.candidate.count(),
      prisma.meeting.count(),
      prisma.decision.count(),
      prisma.flag.count(),
      prisma.analysisRun.count(),
    ]);

  console.log('[seed] Done.');
  console.log(`  organisations : ${orgCount}`);
  console.log(`  managers      : ${mgrCount}`);
  console.log(`  candidates    : ${candidateCount}`);
  console.log(`  meetings      : ${meetingCount}`);
  console.log(`  decisions     : ${decisionCount}`);
  console.log(`  flags         : ${flagCount}`);
  console.log(`  analysis runs : ${runCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
