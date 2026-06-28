import { randomUUID } from 'node:crypto';

// Adversarial RLS / tenant-isolation tests. Opt-in (INTEGRATION=1) — the rest
// of the api suite is mock-only and runs without a DB. To run:
//   1. DATABASE_URL points at a Postgres with app_user + RLS applied
//      (prisma/manual/001–004) AND the aggregate functions (005),
//   2. `npm run seed:reset` has populated the seed org (Meridian) + managers,
//   3. INTEGRATION=1 npm -w api test
//
// These are the NEGATIVE mirror of candidates.integration.test.ts: instead of
// "an owner can write their own row", they assert "a manager cannot see or
// touch another manager's — or another org's — rows". Setup creates a SECOND
// org via systemPrisma so cross-org isolation is actually exercised (the seed
// is single-org); everything created here is torn down in afterAll.
//
// Assertions run through withManagerContext (app_user + RLS) — the real path.
// systemPrisma is used only for setup/teardown and out-of-band verification.

type PrismaLib = typeof import('../lib/prisma');

const ENABLED = process.env.INTEGRATION === '1';
const d = ENABLED ? describe : describe.skip;

d('tenant isolation RLS (integration)', () => {
  let lib: PrismaLib;

  // Org A — resolved from the seed.
  let weiId: string; // a seed manager (role: manager)
  let hrId: string; // the seed hr_admin (Sarah Wong)
  let orgAId: string;
  let priyaMeetingId: string; // a meeting owned by another manager (Priya)
  let priyaFlagId: string; // a flag on that meeting
  let priyaCandidateId: string; // a candidate Priya interviewed but Wei did not

  // Org B — created fresh for cross-org checks.
  let orgBId: string;
  let deptBId: string;
  let mgrBId: string;
  let candidateBId: string;
  let meetingBId: string;
  let flagBId: string;

  beforeAll(async () => {
    lib = await import('../lib/prisma');
    const sp = lib.systemPrisma;

    const wei = await sp.manager.findUnique({ where: { clerkUserId: 'seed_user_wei_liang_tan' } });
    const priya = await sp.manager.findUnique({ where: { clerkUserId: 'seed_user_priya_nair' } });
    const hr = await sp.manager.findUnique({ where: { clerkUserId: 'seed_user_sarah_wong' } });
    if (!wei || !priya || !hr) {
      throw new Error('Integration test needs the seed managers. Run `npm run seed:reset`.');
    }
    weiId = wei.id;
    hrId = hr.id;
    orgAId = wei.orgId;

    // A meeting Priya owns that has at least one flag and a candidate. Priya's
    // candidates (siti/nurul/lakshmi) are not interviewed by Wei, so this
    // doubles as the "non-linked candidate" for the demographics check.
    const pm = await sp.meeting.findFirst({
      where: { managerId: priya.id, flags: { some: {} }, candidates: { some: {} } },
      include: { flags: { take: 1 }, candidates: { take: 1 } },
    });
    if (!pm || pm.flags.length === 0 || pm.candidates.length === 0) {
      throw new Error('Integration test needs a seeded Priya meeting with a flag + candidate.');
    }
    priyaMeetingId = pm.id;
    priyaFlagId = pm.flags[0]!.id;
    priyaCandidateId = pm.candidates[0]!.candidateId;

    // ── Org B ───────────────────────────────────────────────────────────────
    const suffix = randomUUID();
    const orgB = await sp.organisation.create({ data: { name: `RLS Test Org ${suffix}` } });
    orgBId = orgB.id;
    const deptB = await sp.department.create({ data: { orgId: orgB.id, name: 'Dept B' } });
    deptBId = deptB.id;
    const mgrB = await sp.manager.create({
      data: {
        clerkUserId: `rls-test-${suffix}`,
        orgId: orgB.id,
        deptId: deptB.id,
        role: 'manager',
        name: 'Manager B',
        email: `b-${suffix}@rls.test`,
      },
    });
    mgrBId = mgrB.id;
    const candB = await sp.candidate.create({
      data: { orgId: orgB.id, name: 'Candidate B', roleAppliedFor: 'Analyst' },
    });
    candidateBId = candB.id;
    const meetB = await sp.meeting.create({
      data: {
        orgId: orgB.id,
        managerId: mgrB.id,
        title: 'Org B debrief',
        transcript: 'Org B transcript.',
        date: new Date(),
        candidates: { create: [{ candidateId: candB.id }] },
      },
    });
    meetingBId = meetB.id;
    const flagB = await sp.flag.create({
      data: {
        orgId: orgB.id,
        meetingId: meetB.id,
        flagType: 'biased_language',
        excerpt: 'Org B excerpt',
        reasoning: 'Org B reasoning',
        confidenceScore: 0.9,
      },
    });
    flagBId = flagB.id;
  });

  afterAll(async () => {
    if (!lib) return;
    const sp = lib.systemPrisma;
    // Reverse-dependency teardown of everything created for org B.
    if (meetingBId) {
      await sp.flag.deleteMany({ where: { meetingId: meetingBId } });
      await sp.meetingCandidate.deleteMany({ where: { meetingId: meetingBId } });
      await sp.analysisRun.deleteMany({ where: { meetingId: meetingBId } });
      await sp.meeting.deleteMany({ where: { id: meetingBId } });
    }
    if (candidateBId) {
      await sp.candidateDemographics.deleteMany({ where: { candidateId: candidateBId } });
      await sp.candidate.deleteMany({ where: { id: candidateBId } });
    }
    if (mgrBId) await sp.manager.deleteMany({ where: { id: mgrBId } });
    if (deptBId) await sp.department.deleteMany({ where: { id: deptBId } });
    if (orgBId) await sp.organisation.deleteMany({ where: { id: orgBId } });
    await sp.$disconnect();
    await lib.prisma.$disconnect();
  });

  it("a manager cannot read another manager's meetings or flags", async () => {
    const meetings = await lib.withManagerContext(weiId, (tx) =>
      tx.meeting.findMany({ select: { id: true, managerId: true } }),
    );
    expect(meetings.length).toBeGreaterThan(0); // Wei has seeded meetings
    expect(meetings.every((m) => m.managerId === weiId)).toBe(true);
    expect(meetings.some((m) => m.id === priyaMeetingId)).toBe(false);

    const flags = await lib.withManagerContext(weiId, (tx) =>
      tx.flag.findMany({ select: { id: true } }),
    );
    expect(flags.some((f) => f.id === priyaFlagId)).toBe(false);
  });

  it('cross-org rows are invisible to a manager in another org', async () => {
    const meetings = await lib.withManagerContext(weiId, (tx) =>
      tx.meeting.findMany({ select: { orgId: true } }),
    );
    expect(meetings.every((m) => m.orgId === orgAId)).toBe(true);

    const flags = await lib.withManagerContext(weiId, (tx) =>
      tx.flag.findMany({ select: { id: true, orgId: true } }),
    );
    expect(flags.some((f) => f.id === flagBId)).toBe(false);
    expect(flags.every((f) => f.orgId === orgAId)).toBe(true);
  });

  it("a manager cannot update or delete another manager's rows", async () => {
    await expect(
      lib.withManagerContext(weiId, (tx) =>
        tx.meeting.update({ where: { id: priyaMeetingId }, data: { title: 'hijacked' } }),
      ),
    ).rejects.toThrow();

    // DELETE of a row the USING clause hides matches zero rows (no error).
    const del = await lib.withManagerContext(weiId, (tx) =>
      tx.flag.deleteMany({ where: { id: priyaFlagId } }),
    );
    expect(del.count).toBe(0);
    const still = await lib.systemPrisma.flag.findUnique({ where: { id: priyaFlagId } });
    expect(still).not.toBeNull();
  });

  it("a non-linked manager can read but not update another candidate's demographics", async () => {
    // SELECT is org-scoped — Wei can see a same-org candidate's demographics.
    const dem = await lib.withManagerContext(weiId, (tx) =>
      tx.candidateDemographics.findUnique({
        where: { candidateId: priyaCandidateId },
        select: { candidateId: true },
      }),
    );
    expect(dem?.candidateId).toBe(priyaCandidateId);

    // UPDATE requires a MeetingCandidate link to Wei — he has none for this
    // candidate, so the row is hidden from the UPDATE and Prisma throws.
    await expect(
      lib.withManagerContext(weiId, (tx) =>
        tx.candidateDemographics.update({
          where: { candidateId: priyaCandidateId },
          data: { firstLanguage: 'hijacked' },
        }),
      ),
    ).rejects.toThrow();
  });

  it('a query with no manager context returns nothing (safe by default)', async () => {
    const meetings = await lib.prisma.meeting.findMany({ select: { id: true } });
    expect(meetings).toHaveLength(0);
    const flags = await lib.prisma.flag.findMany({ select: { id: true } });
    expect(flags).toHaveLength(0);
  });

  it('HR aggregate functions are scoped to the caller\'s org', async () => {
    const wide = { start: new Date('2000-01-01'), end: new Date('2100-01-01') };

    // Org B's manager sees only org B's single seeded flag.
    const bRows = await lib.withManagerContext(mgrBId, (tx) =>
      tx.$queryRaw<Array<{ flag_type: string; count: bigint }>>`
        SELECT flag_type, count FROM hr_flag_summary(${wide.start}, ${wide.end})`,
    );
    const bTotal = bRows.reduce((s, r) => s + Number(r.count), 0);
    expect(bTotal).toBe(1);

    // The org-A HR admin sees the org's many flags — and org B never bleeds in.
    const aRows = await lib.withManagerContext(hrId, (tx) =>
      tx.$queryRaw<Array<{ flag_type: string; count: bigint }>>`
        SELECT flag_type, count FROM hr_flag_summary(${wide.start}, ${wide.end})`,
    );
    const aTotal = aRows.reduce((s, r) => s + Number(r.count), 0);
    expect(aTotal).toBeGreaterThan(bTotal);
  });

  it('candidate_flag_counts surfaces other managers\' flags as counts only', async () => {
    // Under Wei, a candidate only Priya flagged shows total>0 with own=0 —
    // Wei sees the count, never Priya's flag rows (proved above).
    const rows = await lib.withManagerContext(weiId, (tx) =>
      tx.$queryRaw<Array<{ candidate_id: string; total: bigint; own: bigint }>>`
        SELECT candidate_id, total, own FROM candidate_flag_counts()`,
    );
    const row = rows.find((r) => r.candidate_id === priyaCandidateId);
    expect(row).toBeTruthy();
    expect(Number(row!.total)).toBeGreaterThan(0);
    expect(Number(row!.own)).toBe(0);

    // A cross-org candidate never appears in Wei's counts.
    expect(rows.some((r) => r.candidate_id === candidateBId)).toBe(false);
  });
});
