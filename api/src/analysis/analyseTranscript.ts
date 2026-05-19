import { systemPrisma } from '../lib/prisma';
import { HybridRouter } from './HybridRouter';

const router = new HybridRouter();

export async function runAnalysis(
  runId: string,
  meetingId: string,
  transcript: string,
  orgId: string,
): Promise<void> {
  try {
    await systemPrisma.analysisRun.update({
      where: { id: runId },
      data: { status: 'running', startedAt: new Date() },
    });

    const { flags, llmOk } = await router.analyse(transcript);

    await systemPrisma.flag.createMany({
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

    // The LLM layer degrading is non-fatal — rule flags are still useful — but
    // it must not pass silently. Persist a warning on the (completed) run so
    // it is visible downstream, not just in the logs.
    const degradedNote = llmOk
      ? null
      : 'LLM analysis unavailable — result is rules-only. Check OPENAI_API_KEY and logs.';

    await systemPrisma.analysisRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        modelVersion: router.modelVersion,
        error: degradedNote,
      },
    });

    if (!llmOk) {
      console.warn(`[analysis] run ${runId} completed DEGRADED (rules-only) — ${flags.length} flag(s)`);
    } else {
      console.log(`[analysis] run ${runId} completed — ${flags.length} flag(s) written`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[analysis] run ${runId} failed:`, message);
    // Best-effort: if the failure was the DB itself, this update will also
    // throw — swallow it so the original error stays the logged cause.
    await systemPrisma.analysisRun
      .update({ where: { id: runId }, data: { status: 'failed', error: message } })
      .catch((updateErr) =>
        console.error(`[analysis] could not mark run ${runId} failed:`, updateErr),
      );
  }
}
