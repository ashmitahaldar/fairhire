import { systemPrisma, withManagerContext, type TransactionClient } from '../lib/prisma';
import { HybridRouter } from './HybridRouter';
import type { FlagCandidate } from './types';

const router = new HybridRouter();

// Thrown inside the completion transaction when another path (e.g. the
// /internal endpoint) finalised the run first — rolls back so this
// execution's flags are not written on top of theirs.
class RunFinalisedElsewhere extends Error {}

// Returns every textual occurrence of `excerpt` inside `transcript`,
// stepping forward by 1 from each hit so overlapping matches are not
// missed (matchAll on a literal string only returns first). FlagSpan
// rows for the Week 5 TipTap renderer come from here.
function findExcerptOffsets(transcript: string, excerpt: string): Array<[number, number]> {
  if (!excerpt) return [];
  const hits: Array<[number, number]> = [];
  let from = 0;
  while (from <= transcript.length) {
    const idx = transcript.indexOf(excerpt, from);
    if (idx === -1) break;
    hits.push([idx, idx + excerpt.length]);
    from = idx + 1;
  }
  return hits;
}

// Persists one Flag + its FlagSpan occurrences in the active
// transaction. Returns the created flag id (callers don't need it
// today, but it keeps the helper composable for the eval pipeline
// later). LLM excerpts that aren't verbatim in the transcript
// produce a flag with zero spans — the gutter still renders, the
// transcript highlight just falls back to nothing for that flag.
//
// Exported so the /internal results endpoint writes spans the same
// way this in-process path does — createMany can't nest the span
// rows, so both write paths must funnel through here or they drift.
export async function persistFlagWithSpans(
  tx: TransactionClient,
  candidate: FlagCandidate,
  transcript: string,
  meetingId: string,
  orgId: string,
): Promise<string> {
  const spans = findExcerptOffsets(transcript, candidate.excerpt);
  const flag = await tx.flag.create({
    data: {
      flagType: candidate.flagType,
      excerpt: candidate.excerpt,
      reasoning: candidate.reasoning,
      confidenceScore: candidate.confidenceScore,
      suggestedAlt: candidate.suggestedAlt ?? null,
      meetingId,
      orgId,
      spans: {
        create: spans.map(([startOffset, endOffset]) => ({ startOffset, endOffset })),
      },
    },
    select: { id: true },
  });
  return flag.id;
}

export async function runAnalysis(runId: string): Promise<void> {
  // Wrap the entire body — a throw at any step (lookup, claim, analyse,
  // finalise) lands in the same best-effort failure marker below. Without
  // this, a DB blip during the lookup or claim would leave the run stuck
  // at pending/running with no recorded cause.
  try {
    // Derive meetingId/orgId/managerId/transcript from the authoritative run
    // record — never trust a caller-passed tuple. The lookup uses systemPrisma
    // because a background job has no manager context (same reason as the
    // /internal route); all writes run under withManagerContext so RLS
    // WITH CHECK still enforces tenant ownership.
    const run = await systemPrisma.analysisRun.findUnique({
      where: { id: runId },
      select: {
        status: true,
        meeting: {
          select: {
            id: true,
            orgId: true,
            managerId: true,
            transcript: true,
            meetingType: true,
          },
        },
      },
    });

    if (!run) {
      console.error(`[analysis] run ${runId} not found — aborting`);
      return;
    }

    const { id: meetingId, orgId, managerId, transcript, meetingType } = run.meeting;

    // Atomic claim: only a pending run may be picked up. If a concurrent
    // execution (retry, duplicate scheduling, deploy restart, or the /internal
    // endpoint) already moved it out of pending, no-op — never re-run analysis
    // or write duplicate flags.
    const claim = await withManagerContext(managerId, (tx) =>
      tx.analysisRun.updateMany({
        where: { id: runId, status: 'pending' },
        data: { status: 'running', startedAt: new Date() },
      }),
    );
    if (claim.count === 0) {
      console.warn(`[analysis] run ${runId} not pending (status=${run.status}) — skipping`);
      return;
    }

    const { flags, llmOk } = await router.analyse(transcript, meetingType);

    // The LLM layer degrading is non-fatal — rule flags are still useful — but
    // it must not pass silently. Persist a warning on the (completed) run so
    // it is visible downstream, not just in the logs.
    const degradedNote = llmOk
      ? null
      : 'LLM analysis unavailable — result is rules-only. Check OPENAI_API_KEY and logs.';

    await withManagerContext(managerId, async (tx) => {
      // Guard the completion transition too: if another path finalised the
      // run while analysis was running, abort without writing flags so the
      // result is not duplicated and the terminal status is not clobbered.
      const finalise = await tx.analysisRun.updateMany({
        where: { id: runId, status: 'running' },
        data: {
          status: 'completed',
          completedAt: new Date(),
          modelVersion: router.modelVersion,
          error: degradedNote,
        },
      });

      if (finalise.count === 0) throw new RunFinalisedElsewhere();

      // Persist each flag + its FlagSpan occurrences. Step 3 of the
      // Week 5 plan switches the transcript renderer to TipTap which
      // reads spans as decoration ranges; LLM excerpts that aren't
      // verbatim in the transcript produce zero spans and fall back
      // to gutter-only display.
      //
      // Per-flag insert (vs createMany) because the spans nested-create
      // needs the parent flag id — keeps the write atomic per flag.
      // Analysis is background-scheduled, so the extra round-trips don't
      // affect any user-facing latency.
      for (const f of flags) {
        await persistFlagWithSpans(tx, f, transcript, meetingId, orgId);
      }
    });

    if (!llmOk) {
      console.warn(`[analysis] run ${runId} completed DEGRADED (rules-only) — ${flags.length} flag(s)`);
    } else {
      console.log(`[analysis] run ${runId} completed — ${flags.length} flag(s) written`);
    }
  } catch (err) {
    if (err instanceof RunFinalisedElsewhere) {
      console.warn(`[analysis] run ${runId} finalised by another path — discarding this result`);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[analysis] run ${runId} failed:`, message);
    // Best-effort, and only if still non-terminal so a concurrent completion
    // is not overwritten. systemPrisma (RLS-bypassing) so it records even if
    // the failure was the withManagerContext / RLS path itself.
    await systemPrisma.analysisRun
      .updateMany({
        where: { id: runId, status: { in: ['pending', 'running'] } },
        data: { status: 'failed', error: message },
      })
      .catch((updateErr) =>
        console.error(`[analysis] could not mark run ${runId} failed:`, updateErr),
      );
  }
}
