// RLS policy-coverage matrix. Opt-in (INTEGRATION=1). Introspects pg_tables +
// pg_policies and asserts every protected table has RLS enabled AND exactly
// its expected set of policy commands. This turns "intent" into an enforced
// contract: a missing policy (the Week 4 UPDATE gap, the Week 5 DELETE gap)
// fails here in one shot rather than being discovered one bug at a time.
//
// When a new code path legitimately needs a new command on a table, update
// EXPECTED here together with the policy in prisma/manual/ — the two move as
// a pair, by design.
//
// To run: see rls.integration.test.ts (needs a DB with 001–005 applied).

type PrismaLib = typeof import('../lib/prisma');

const ENABLED = process.env.INTEGRATION === '1';
const d = ENABLED ? describe : describe.skip;

// Declared intent, per table. DELETE is intentionally absent except on flags
// (re-run wipe). flag_spans / candidate_demographics omit DELETE (cascade /
// upsert-only). Update this map and the matching SQL policy together.
const EXPECTED: Record<string, string[]> = {
  organisations: ['SELECT'],
  departments: ['SELECT'],
  managers: ['SELECT', 'INSERT', 'UPDATE'],
  candidates: ['SELECT', 'INSERT', 'UPDATE'],
  candidate_demographics: ['SELECT', 'INSERT', 'UPDATE'],
  meetings: ['SELECT', 'INSERT', 'UPDATE'],
  meeting_candidates: ['SELECT', 'INSERT'],
  decisions: ['SELECT', 'INSERT', 'UPDATE'],
  flags: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  flag_spans: ['SELECT', 'INSERT', 'UPDATE'],
  analysis_runs: ['SELECT', 'INSERT', 'UPDATE'],
};

d('RLS policy coverage (integration)', () => {
  let lib: PrismaLib;

  beforeAll(async () => {
    lib = await import('../lib/prisma');
  });

  afterAll(async () => {
    if (!lib) return;
    await lib.systemPrisma.$disconnect();
    await lib.prisma.$disconnect();
  });

  it('every protected table has row-level security enabled', async () => {
    const rows = await lib.systemPrisma.$queryRaw<
      Array<{ tablename: string; rowsecurity: boolean }>
    >`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`;
    const byName = new Map(rows.map((r) => [r.tablename, r.rowsecurity]));

    for (const table of Object.keys(EXPECTED)) {
      expect(byName.get(table)).toBe(true);
    }
  });

  it('every protected table has exactly its expected policy command set', async () => {
    const rows = await lib.systemPrisma.$queryRaw<
      Array<{ tablename: string; cmd: string }>
    >`SELECT tablename, cmd FROM pg_policies WHERE schemaname = 'public'`;

    const actual = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!(r.tablename in EXPECTED)) continue;
      if (!actual.has(r.tablename)) actual.set(r.tablename, new Set());
      actual.get(r.tablename)!.add(r.cmd);
    }

    for (const [table, cmds] of Object.entries(EXPECTED)) {
      const got = [...(actual.get(table) ?? new Set<string>())].sort();
      expect({ table, cmds: got }).toEqual({ table, cmds: [...cmds].sort() });
    }
  });
});
