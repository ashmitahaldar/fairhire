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

// Use DIRECT_URL (superuser) so RLS does not block seed writes
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
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

  const dept = await prisma.department.create({
    data: { orgId: org.id, name: 'Investment Banking' },
  });

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
        clerkUserId: 'seed_user_priya_nair',
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
  // between two arrays to keep aligned.
  const candidates = await Promise.all(
    candidateSpecs.map((spec) =>
      prisma.candidate.create({
        data: {
          orgId: org.id,
          name: spec.name,
          roleAppliedFor: spec.roleAppliedFor,
          demographics: { create: { orgId: org.id, ...spec.demographics } },
        },
      }),
    ),
  );

  const [ahmad, siti, rajesh, meiLing, kevin, lakshmi, azri, , ravi, nurul] = candidates;

  // ─── Meetings ────────────────────────────────────────────────────────────────

  console.log('[seed] Creating meetings...');

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
        date: new Date('2026-01-15'),
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: wei.id,
        title: 'Senior Analyst Interview — Rajesh Kumar',
        transcript: transcripts.wei_rajesh,
        date: new Date('2026-01-22'),
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: wei.id,
        title: 'Associate Interview — Muhammad Azri',
        transcript: transcripts.wei_muhammad,
        date: new Date('2026-02-05'),
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: wei.id,
        title: 'Analyst Interview — Kevin Tan',
        transcript: transcripts.wei_kevin,
        date: new Date('2026-02-12'),
      },
    }),
    // Priya Nair — asymmetric_concern pattern
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: priya.id,
        title: 'Analyst Interview — Siti Nurhaliza',
        transcript: transcripts.priya_siti,
        date: new Date('2026-01-18'),
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: priya.id,
        title: 'Associate Director Interview — Nurul Izzah',
        transcript: transcripts.priya_nurul,
        date: new Date('2026-02-03'),
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: priya.id,
        title: 'Director Interview — Lakshmi Krishnamurthy',
        transcript: transcripts.priya_lakshmi,
        date: new Date('2026-02-20'),
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: priya.id,
        title: 'Associate Interview — Mei Ling Chua',
        transcript: transcripts.priya_mei_ling,
        date: new Date('2026-03-10'),
      },
    }),
    // David Lim — hedging_language + age_bias pattern
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: david.id,
        title: 'Senior Analyst 2nd Round — Rajesh Kumar',
        transcript: transcripts.david_rajesh,
        date: new Date('2026-01-25'),
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: david.id,
        title: 'Director Interview — Ravi Shankar',
        transcript: transcripts.david_ravi,
        date: new Date('2026-02-08'),
      },
    }),
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: david.id,
        title: 'Director 2nd Round — Lakshmi Krishnamurthy',
        transcript: transcripts.david_lakshmi,
        date: new Date('2026-02-28'),
      },
    }),
    // Marcus Chen — clean
    prisma.meeting.create({
      data: {
        orgId: org.id,
        managerId: marcus.id,
        title: 'Analyst Final Round — Kevin Tan',
        transcript: transcripts.marcus_kevin,
        date: new Date('2026-03-05'),
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
        dismissedAt: new Date('2026-02-07'),
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
        dismissedAt: new Date('2026-02-05'),
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
        dismissedAt: new Date('2026-02-10'),
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

  // Marcus Chen — clean (2 low-confidence false positives, both dismissed)
  await prisma.flag.createMany({
    data: [
      {
        orgId: org.id,
        meetingId: m12.id,
        flagType: 'age_bias',
        excerpt: 'Kevin showed high energy and genuine enthusiasm throughout the process.',
        reasoning:
          'Low confidence: "energy" mentioned in a positive context. No age-related concern present — this is a positive observation about a young candidate, not a comparative dismissal of older candidates.',
        confidenceScore: 0.28,
        suggestedAlt: null,
        dismissed: true,
        dismissReason: 'False positive. This is a positive observation with no comparative age bias present.',
        dismissedAt: new Date('2026-03-06'),
        dismissedBy: marcus.id,
      },
      {
        orgId: org.id,
        meetingId: m12.id,
        flagType: 'criteria_drift',
        excerpt: 'He would represent the team well externally from day one.',
        reasoning:
          'Low confidence: external representation mentioned. No language or ethnicity-based concern — positive assessment of a Chinese candidate that does not imply differential standards.',
        confidenceScore: 0.32,
        suggestedAlt: null,
        dismissed: true,
        dismissReason: 'False positive. Straightforward positive assessment with no comparative bias evident.',
        dismissedAt: new Date('2026-03-06'),
        dismissedBy: marcus.id,
      },
    ],
  });

  // ─── Analysis runs ────────────────────────────────────────────────────────────

  console.log('[seed] Creating analysis runs...');

  await prisma.analysisRun.createMany({
    data: [
      {
        orgId: org.id,
        meetingId: m1.id,
        status: 'completed',
        modelVersion: 'claude-3-5-sonnet-20241022',
        startedAt: new Date('2026-01-15T14:05:00Z'),
        completedAt: new Date('2026-01-15T14:05:47Z'),
      },
      {
        orgId: org.id,
        meetingId: m5.id,
        status: 'completed',
        modelVersion: 'claude-3-5-sonnet-20241022',
        startedAt: new Date('2026-01-18T16:12:00Z'),
        completedAt: new Date('2026-01-18T16:12:53Z'),
      },
      {
        orgId: org.id,
        meetingId: m12.id,
        status: 'pending',
      },
    ],
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
