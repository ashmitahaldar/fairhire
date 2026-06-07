import { PrismaClient } from '@prisma/client';

// ─── App client (app_user role — RLS enforced) ────────────────────────────
// Used for all normal request handling. Connects as app_user so RLS policies
// apply. Every query must be wrapped in withManagerContext to set the session
// variable, otherwise RLS returns 0 rows.

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ─── System client (postgres superuser — RLS bypassed) ────────────────────
// Permitted only when no manager context can exist. Two legitimate shapes:
//
//   1. Pre-auth bootstrap — code that runs before req.manager is resolved.
//        - requireAuth: lookup manager by clerkUserId
//        - POST /auth/sync: upsert manager + org/dept findFirst (first login)
//
//   2. Context-less code paths — code that runs outside any Clerk-authed
//      request and so cannot set app.current_manager_id. Prefer to use
//      systemPrisma only for the initial lookup, then derive managerId from
//      the loaded row and route subsequent writes through withManagerContext
//      so RLS WITH CHECK still enforces ownership.
//        - POST /internal/.../results: secret-authenticated, no Clerk JWT
//        - runAnalysis (background job): no HTTP request
//        - runAnalysis best-effort failure marker: must record even if the
//          withManagerContext path is what failed
//
// Never use systemPrisma from a Clerk-authed route handler — use
// withManagerContext(req.manager.id, ...) so RLS enforces ownership.
//
// New systemPrisma call sites must be added to the lists above by the
// reviewer, so the bypass surface stays visible in diffs.

export const systemPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
  log: ['error'],
});

// ─── Context helper ───────────────────────────────────────────────────────

export type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Runs fn inside a transaction with app.current_manager_id set.
 * RLS policies on all tables check this session variable, so every
 * query inside fn is automatically scoped to the given manager.
 *
 * Timeout is raised well above Prisma's 5s default: the database lives in
 * Supabase Tokyo, and nested includes (e.g. meeting → candidates →
 * demographics + flags + analysisRuns) plus round-trip overshoot 5s
 * routinely. maxWait covers connection-pool acquisition under contention.
 */
export async function withManagerContext<T>(
  managerId: string,
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_manager_id', ${managerId}, true)`;
      return fn(tx);
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}
