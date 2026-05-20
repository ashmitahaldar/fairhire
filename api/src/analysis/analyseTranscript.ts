import { systemPrisma, withManagerContext } from '../lib/prisma';
import { HybridRouter } from './HybridRouter';

const router = new HybridRouter();

// Thrown inside the completion transaction when another path (e.g. the
// /internal endpoint) finalised the run first — rolls back so this
// execution's flags are not written on top of theirs.
class RunFinalisedElsewhere extends Error {}

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
          select: { id: true, orgId: true, managerId: true, transcript: true },
        },
      },
    });

    if (!run) {
      console.error(`[analysis] run ${runId} not found — aborting`);
      return;
    }

    const { id: meetingId, orgId, managerId, transcript } = run.meeting;

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

    const { flags, llmOk } = await router.analyse(transcript);

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

      if (flags.length > 0) {
        await tx.flag.createMany({
          data: flags.map((f) => ({
            flagType: f.flagType,
            excerpt: f.excerpt,
            reasoning: f.reasoning,
            confidenceScore: f.confidenceScore,
            suggestedAlt: f.suggestedAlt ?? null,
            meetingId,
            orgId,
          })),
        });
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
