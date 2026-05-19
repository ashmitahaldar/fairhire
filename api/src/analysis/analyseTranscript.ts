import { systemPrisma, withManagerContext } from '../lib/prisma';
import { HybridRouter } from './HybridRouter';

const router = new HybridRouter();

export async function runAnalysis(runId: string): Promise<void> {
  // Derive meetingId/orgId/managerId/transcript from the authoritative run
  // record — never trust a caller to pass a consistent tuple (a mismatched
  // orgId would otherwise write cross-tenant rows). The lookup uses
  // systemPrisma because a background job has no manager context (same reason
  // as the /internal route); all writes below run under withManagerContext so
  // RLS WITH CHECK still enforces tenant ownership.
  const run = await systemPrisma.analysisRun.findUnique({
    where: { id: runId },
    select: {
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

  try {
    await withManagerContext(managerId, (tx) =>
      tx.analysisRun.update({
        where: { id: runId },
        data: { status: 'running', startedAt: new Date() },
      }),
    );

    const { flags, llmOk } = await router.analyse(transcript);

    // The LLM layer degrading is non-fatal — rule flags are still useful — but
    // it must not pass silently. Persist a warning on the (completed) run so
    // it is visible downstream, not just in the logs.
    const degradedNote = llmOk
      ? null
      : 'LLM analysis unavailable — result is rules-only. Check OPENAI_API_KEY and logs.';

    await withManagerContext(managerId, async (tx) => {
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

      await tx.analysisRun.update({
        where: { id: runId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          modelVersion: router.modelVersion,
          error: degradedNote,
        },
      });
    });

    if (!llmOk) {
      console.warn(`[analysis] run ${runId} completed DEGRADED (rules-only) — ${flags.length} flag(s)`);
    } else {
      console.log(`[analysis] run ${runId} completed — ${flags.length} flag(s) written`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[analysis] run ${runId} failed:`, message);
    // Best-effort failure marker via systemPrisma (RLS-bypassing) so it still
    // records even if the failure was the withManagerContext / RLS path itself.
    await systemPrisma.analysisRun
      .update({ where: { id: runId }, data: { status: 'failed', error: message } })
      .catch((updateErr) =>
        console.error(`[analysis] could not mark run ${runId} failed:`, updateErr),
      );
  }
}
