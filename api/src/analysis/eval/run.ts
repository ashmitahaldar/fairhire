import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { FLAG_TYPES, type FlagType } from '@fairhire/shared';
import { systemPrisma } from '../../lib/prisma';
import { HybridRouter } from '../HybridRouter';
import {
  addCounts,
  computePRF,
  DEMOGRAPHIC_DIMENSIONS,
  fairnessByDimension,
  matchFlags,
  type CandidateFlagging,
  type Counts,
  type DemographicDimension,
  type GroupStat,
  type PRF,
} from './metrics';

// Offline eval: re-runs the analysis engine on every seeded meeting and scores
// its output against the labelled (seed) flags. Read-only — uses systemPrisma
// for RLS-bypassing reads and never writes. Runs the LLM, so it needs
// OPENAI_API_KEY + network; run with: npm run eval  (degrades to rules-only if
// the LLM is unavailable, noting how many meetings degraded).

interface TypeResult extends Counts, PRF {
  flagType: FlagType;
}

interface FpDetail {
  meeting: string;
  flagType: FlagType;
  excerpt: string;
  confidence: number;
  reasoning: string;
}

interface FnDetail {
  meeting: string;
  flagType: FlagType;
  excerpt: string;
  labelledConfidence: number;
}

interface EvalResult {
  timestamp: string;
  model: string;
  meetingsEvaluated: number;
  degradedMeetings: number;
  overall: Counts & PRF;
  perType: TypeResult[];
  falsePositives: FpDetail[];
  falseNegatives: FnDetail[];
  fairness: { dimension: DemographicDimension; groups: GroupStat[] }[];
}

const fmt = (x: number | null) => (x === null ? 'n/a' : x.toFixed(2));

function renderMarkdown(r: EvalResult): string {
  const lines: string[] = [];
  lines.push(`# FairHire eval — ${r.timestamp}`);
  lines.push(
    `Model: \`${r.model}\` · meetings evaluated: ${r.meetingsEvaluated}` +
      (r.degradedMeetings > 0 ? ` · ${r.degradedMeetings} LLM-degraded (rules-only)` : ''),
  );

  lines.push('');
  lines.push('## Detection (precision / recall / F1)');
  lines.push('| Category | TP | FP | FN | P | R | F1 |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|');
  lines.push(
    `| **Overall** | ${r.overall.tp} | ${r.overall.fp} | ${r.overall.fn} | ` +
      `${fmt(r.overall.precision)} | ${fmt(r.overall.recall)} | ${fmt(r.overall.f1)} |`,
  );
  for (const t of r.perType) {
    lines.push(
      `| ${t.flagType} | ${t.tp} | ${t.fp} | ${t.fn} | ` +
        `${fmt(t.precision)} | ${fmt(t.recall)} | ${fmt(t.f1)} |`,
    );
  }

  lines.push('');
  lines.push(`## False positives — engine flagged, not labelled (${r.falsePositives.length})`);
  if (r.falsePositives.length === 0) lines.push('_none_');
  for (const fp of r.falsePositives) {
    lines.push(`- **${fp.flagType}** (conf ${fp.confidence.toFixed(2)}) · _${fp.meeting}_`);
    lines.push(`  > ${fp.excerpt}`);
  }

  lines.push('');
  lines.push(`## False negatives — labelled, engine missed (${r.falseNegatives.length})`);
  if (r.falseNegatives.length === 0) lines.push('_none_');
  for (const fn of r.falseNegatives) {
    lines.push(`- **${fn.flagType}** (labelled conf ${fn.labelledConfidence.toFixed(2)}) · _${fn.meeting}_`);
    lines.push(`  > ${fn.excerpt}`);
  }

  lines.push('');
  lines.push('## Fairness — flag totals by demographic group');
  lines.push('_Small samples (n < 10) are indicative only, not statistically significant._');
  for (const dim of r.fairness) {
    lines.push('');
    lines.push(`### ${dim.dimension}`);
    lines.push('| Group | n | flagged candidates | total flags |');
    lines.push('|---|---:|---:|---:|');
    for (const g of dim.groups) {
      lines.push(`| ${g.value} | ${g.n} | ${g.flaggedCandidates} | ${g.totalFlags} |`);
    }
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const router = new HybridRouter();

  const meetings = await systemPrisma.meeting.findMany({
    select: {
      title: true,
      transcript: true,
      flags: { select: { flagType: true, excerpt: true, confidenceScore: true } },
      candidates: {
        select: {
          candidate: {
            select: {
              id: true,
              demographics: {
                select: { race: true, gender: true, ageBand: true, nationalityStatus: true },
              },
            },
          },
        },
      },
    },
  });

  if (meetings.length === 0) {
    console.log('No meetings found — seed the database first (npm run seed:reset).');
    return;
  }

  let overall: Counts = { tp: 0, fp: 0, fn: 0 };
  const perType = new Map<FlagType, Counts>(
    FLAG_TYPES.map((t) => [t, { tp: 0, fp: 0, fn: 0 }] as [FlagType, Counts]),
  );
  const candidateFlagging = new Map<string, CandidateFlagging>();
  const falsePositives: FpDetail[] = [];
  const falseNegatives: FnDetail[] = [];
  let degraded = 0;

  for (const m of meetings) {
    const { flags, llmOk } = await router.analyse(m.transcript);
    if (!llmOk) degraded += 1;

    const match = matchFlags(flags, m.flags);
    overall = addCounts(overall, match);
    for (const fp of match.falsePositives) {
      falsePositives.push({
        meeting: m.title,
        flagType: fp.flagType,
        excerpt: fp.excerpt,
        confidence: fp.confidenceScore,
        reasoning: fp.reasoning,
      });
    }
    for (const fn of match.falseNegatives) {
      falseNegatives.push({
        meeting: m.title,
        flagType: fn.flagType,
        excerpt: fn.excerpt,
        labelledConfidence: fn.confidenceScore,
      });
    }

    for (const t of FLAG_TYPES) {
      const p = flags.filter((f) => f.flagType === t);
      const g = m.flags.filter((f) => f.flagType === t);
      if (p.length === 0 && g.length === 0) continue;
      perType.set(t, addCounts(perType.get(t)!, matchFlags(p, g)));
    }

    for (const mc of m.candidates) {
      const c = mc.candidate;
      let rec = candidateFlagging.get(c.id);
      if (!rec) {
        rec = {
          demographics: {
            race: c.demographics?.race ?? null,
            gender: c.demographics?.gender ?? null,
            ageBand: c.demographics?.ageBand ?? null,
            nationalityStatus: c.demographics?.nationalityStatus ?? null,
          },
          flagCount: 0,
        };
        candidateFlagging.set(c.id, rec);
      }
      rec.flagCount += flags.length;
    }

    console.error(
      `  ${m.title}: ${flags.length} predicted vs ${m.flags.length} labelled` +
        (llmOk ? '' : ' (LLM degraded — rules only)'),
    );
  }

  const candidates = [...candidateFlagging.values()];
  const result: EvalResult = {
    timestamp: new Date().toISOString(),
    model: router.modelVersion,
    meetingsEvaluated: meetings.length,
    degradedMeetings: degraded,
    overall: { ...overall, ...computePRF(overall) },
    perType: FLAG_TYPES.map((t) => {
      const counts = perType.get(t)!;
      return { flagType: t, ...counts, ...computePRF(counts) };
    }),
    falsePositives,
    falseNegatives,
    fairness: DEMOGRAPHIC_DIMENSIONS.map((dimension) => ({
      dimension,
      groups: fairnessByDimension(candidates, dimension),
    })),
  };

  mkdirSync('evals/runs', { recursive: true });
  const path = `evals/runs/${result.timestamp.replace(/[:.]/g, '-')}.json`;
  writeFileSync(path, JSON.stringify(result, null, 2));

  console.log('\n' + renderMarkdown(result));
  console.log(`\nJSON written to ${path}`);
}

main()
  .catch((err) => {
    console.error('[eval] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => systemPrisma.$disconnect());
