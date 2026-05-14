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
// Used only for the two bootstrap operations that happen before a manager ID
// is known: looking up a manager by clerkUserId in requireAuth, and upserting
// a manager row in POST /auth/sync. Never use this for regular route handlers.

export const systemPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
  log: ['error'],
});

// ─── Context helper ───────────────────────────────────────────────────────

type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Runs fn inside a transaction with app.current_manager_id set.
 * RLS policies on all tables check this session variable, so every
 * query inside fn is automatically scoped to the given manager.
 */
export async function withManagerContext<T>(
  managerId: string,
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_manager_id', ${managerId}, true)`;
    return fn(tx);
  });
}
