import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRaw<{ tablename: string; rowsecurity: boolean }[]>`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE '\_%'
    ORDER BY tablename
  `;

  const policies = await prisma.$queryRaw<{ tablename: string; policyname: string; cmd: string }[]>`
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `;

  console.log('\n── RLS enabled ──────────────────────');
  for (const t of tables) {
    const status = t.rowsecurity ? '✓' : '✗ MISSING';
    console.log(`  ${status}  ${t.tablename}`);
  }

  console.log('\n── Policies ─────────────────────────');
  for (const p of policies) {
    console.log(`  ${p.tablename}: ${p.policyname} (${p.cmd})`);
  }

  const missing = tables.filter((t) => !t.rowsecurity);
  if (missing.length > 0) {
    console.error('\nERROR: RLS not enabled on:', missing.map((t) => t.tablename).join(', '));
    process.exit(1);
  }
  console.log('\nAll tables have RLS enabled.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
