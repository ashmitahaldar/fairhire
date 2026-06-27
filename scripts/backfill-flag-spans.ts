import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// One-shot backfill: for every existing Flag, find every textual
// occurrence of its excerpt inside its meeting's transcript and write
// a FlagSpan row per occurrence.
//
// Idempotent — if a Flag already has FlagSpan rows we skip it. Safe to
// re-run if the script is interrupted partway through.
//
// Why: Week 5 introduces FlagSpan (one row per occurrence) so TipTap
// can render decorations from server-supplied offsets instead of doing
// client-side indexOf. Pre-Week-5 Flag rows have no spans; the engine
// emits them going forward, but historical rows need backfilling.
//
// Unmatched excerpts (e.g. paraphrased rather than verbatim) are
// logged and left without spans; the UI falls back to gutter-only
// display for those flags.
//
// Runs as DIRECT_URL (superuser) because RLS isn't relevant for an
// admin maintenance script. Mirrors scripts/seed.ts.

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
});

// Walk through every occurrence of `needle` in `hay` using indexOf so
// we capture overlapping/multi-instance hits — `matchAll` with a string
// only returns the first hit and `String.indexOf` with a fromIndex is
// the simplest correct way to enumerate them.
function findAllOffsets(hay: string, needle: string): Array<[number, number]> {
  if (!needle) return [];
  const hits: Array<[number, number]> = [];
  let from = 0;
  while (from <= hay.length) {
    const idx = hay.indexOf(needle, from);
    if (idx === -1) break;
    hits.push([idx, idx + needle.length]);
    from = idx + 1; // step forward by 1 so overlapping matches still surface
  }
  return hits;
}

async function main() {
  console.log('[backfill-flag-spans] starting');

  const flags = await prisma.flag.findMany({
    select: {
      id: true,
      excerpt: true,
      meetingId: true,
      meeting: { select: { transcript: true } },
      spans: { select: { id: true }, take: 1 },
    },
  });

  console.log(`[backfill-flag-spans] inspecting ${flags.length} flag(s)`);

  let inserted = 0;
  let skippedExisting = 0;
  const unmatched: Array<{ flagId: string; excerpt: string }> = [];

  for (const flag of flags) {
    if (flag.spans.length > 0) {
      skippedExisting += 1;
      continue;
    }

    const hits = findAllOffsets(flag.meeting.transcript, flag.excerpt);
    if (hits.length === 0) {
      unmatched.push({ flagId: flag.id, excerpt: flag.excerpt });
      continue;
    }

    await prisma.flagSpan.createMany({
      data: hits.map(([startOffset, endOffset]) => ({
        flagId: flag.id,
        startOffset,
        endOffset,
      })),
    });
    inserted += hits.length;
  }

  console.log(`[backfill-flag-spans] inserted ${inserted} span(s)`);
  console.log(`[backfill-flag-spans] skipped ${skippedExisting} flag(s) with existing spans`);
  if (unmatched.length > 0) {
    console.warn(
      `[backfill-flag-spans] ${unmatched.length} flag(s) had no verbatim transcript match — left without spans:`,
    );
    for (const u of unmatched.slice(0, 20)) {
      console.warn(`  · flag ${u.flagId}: "${u.excerpt.slice(0, 80)}${u.excerpt.length > 80 ? '…' : ''}"`);
    }
    if (unmatched.length > 20) console.warn(`  · …and ${unmatched.length - 20} more`);
  }
  console.log('[backfill-flag-spans] done');
}

main()
  .catch((e) => {
    console.error('[backfill-flag-spans] failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
