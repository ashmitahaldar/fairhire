import { PrismaClient } from '@prisma/client';

// Singleton — reuses the client across hot reloads in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

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
