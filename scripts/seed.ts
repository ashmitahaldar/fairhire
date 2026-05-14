// Seed script — destructive then rebuild
// Full seed data added in Step 7 (after Prisma schema is complete)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  // TODO: truncate all tables and reseed with synthetic data in Step 7
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
