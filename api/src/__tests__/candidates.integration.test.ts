// Opt-in integration test for RLS UPDATE on the candidates + demographics
// tables. Skipped by default — the rest of the api suite is mock-only and
// runs without a DB. Set INTEGRATION=1 to enable, and make sure:
//   - DATABASE_URL points at a Postgres that has app_user + RLS policies
//     applied (see prisma/manual/001_rls.sql + 002_rls_candidate_demographics.sql),
//   - `npm run seed` has been run so a manager + candidate + meeting link exist.
//
// This test exists because the mock-prisma route tests (candidates.test.ts)
// cannot catch the RLS-blocks-UPDATE bug that shipped in the original Week 4
// PR — Prisma is stubbed so the real session-variable + USING clause path
// is never exercised. A single round-trip per write route is enough to
// document the bug class and catch a regression.

import { prisma, systemPrisma, withManagerContext } from '../lib/prisma';

const ENABLED = process.env.INTEGRATION === '1';
const d = ENABLED ? describe : describe.skip;

d('candidates write RLS (integration)', () => {
  // Resolve a manager + a candidate they've interviewed. Uses systemPrisma
  // for the lookup so RLS doesn't get in the way of test setup — the actual
  // assertions go through `prisma` (app_user) under withManagerContext.
  let managerId: string;
  let candidateId: string;

  beforeAll(async () => {
    const link = await systemPrisma.meetingCandidate.findFirst({
      where: { candidate: { deletedAt: null } },
      select: {
        candidateId: true,
        meeting: { select: { managerId: true } },
      },
    });
    if (!link) {
      throw new Error(
        'Integration test needs at least one MeetingCandidate link in the DB. Run `npm run seed`.',
      );
    }
    managerId = link.meeting.managerId;
    candidateId = link.candidateId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await systemPrisma.$disconnect();
  });

  it('UPDATE on candidates succeeds for a manager with a MeetingCandidate link', async () => {
    // No-op rename — set name back to its current value. The assertion is
    // that the update returns the row, not that anything changed. If the
    // RLS UPDATE policy is missing, Prisma throws "Record to update not
    // found" because the USING clause hides the row.
    const original = await systemPrisma.candidate.findUnique({
      where: { id: candidateId },
      select: { name: true },
    });
    if (!original) throw new Error('Seed candidate vanished between setup and test');

    const updated = await withManagerContext(managerId, async (tx) => {
      return tx.candidate.update({
        where: { id: candidateId },
        data: { name: original.name },
        select: { id: true, name: true },
      });
    });

    expect(updated.id).toBe(candidateId);
    expect(updated.name).toBe(original.name);
  });

  it('UPDATE on candidate_demographics succeeds via nested upsert for a linked manager', async () => {
    // Upserts a demographics row touching only firstLanguage — no destructive
    // change; just exercises the UPDATE-or-CREATE round-trip end-to-end. If
    // the RLS UPDATE policy on candidate_demographics is missing and a row
    // already exists, the upsert fails (only INSERT is policy-allowed).
    const result = await withManagerContext(managerId, async (tx) => {
      return tx.candidate.update({
        where: { id: candidateId },
        data: {
          demographics: {
            upsert: {
              create: { firstLanguage: null },
              update: { firstLanguage: null },
            },
          },
        },
        select: {
          id: true,
          demographics: { select: { firstLanguage: true } },
        },
      });
    });

    expect(result.id).toBe(candidateId);
    expect(result.demographics?.firstLanguage).toBeNull();
  });
});
