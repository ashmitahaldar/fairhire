import { Router } from 'express';
import {
  createCandidateBody,
  updateCandidateBody,
  type DecisionOutcome,
  type DemographicsInput,
  type MeetingType,
} from '@fairhire/shared';
import { withManagerContext } from '../lib/prisma';
import { requireOwnership } from '../middleware/requireOwnership';

export const candidatesRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────

// Filter the demographics payload down to only the keys actually present on
// the wire. Lets PATCH submit a partial body and not clobber fields the
// caller didn't touch. Explicit `null` is preserved (caller wants to clear);
// `undefined` is dropped. Returns `null` (not `{}`) when nothing remains —
// so the caller can `if (dem) …` without spuriously creating an empty
// demographics row when the client sent `demographics: {}`.
function pickDefined(input: DemographicsInput): DemographicsInput | null {
  const out: DemographicsInput = {};
  for (const [k, v] of Object.entries(input) as Array<
    [keyof DemographicsInput, DemographicsInput[keyof DemographicsInput]]
  >) {
    if (v !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Shape the Prisma row into the wire response. Collapses the nested helper
// fields (_count, decisions, meetings) into the flat shape the candidates
// page expects.
interface CandidateRowFromDb {
  id: string;
  name: string;
  roleAppliedFor: string;
  createdAt: Date;
  demographics:
    | (Omit<DemographicsInput, 'firstLanguage'> & { firstLanguage: string | null })
    | null;
  _count: { meetings: number };
  decisions: Array<{ outcome: DecisionOutcome; meeting: { meetingType: MeetingType } }>;
  meetings: Array<{ meetingId: string }>;
}

// flagCount is sourced separately from the candidate_flag_counts() aggregate
// function, not the Prisma row — the org-wide `total` can't come through the
// RLS-scoped flag includes. Defaults to zero for candidates with no flags
// (and for the POST/PATCH responses, where the list refetch is authoritative).
function toWireCandidate(
  row: CandidateRowFromDb,
  flagCount: { total: number; own: number } = { total: 0, own: 0 },
) {
  const lastDecision = row.decisions[0];
  return {
    id: row.id,
    name: row.name,
    roleAppliedFor: row.roleAppliedFor,
    createdAt: row.createdAt,
    demographics: row.demographics,
    meetingCount: row._count.meetings,
    lastDecisionOutcome: lastDecision?.outcome ?? null,
    // Mode of the meeting the last decision was recorded against, so the
    // client can label promotion outcomes (promoted/held) correctly
    // instead of falling through a hiring-only label map.
    lastDecisionMeetingType: lastDecision?.meeting.meetingType ?? null,
    canModify: row.meetings.length > 0,
    // total = flags raised for this candidate across the whole org (incl.
    // other managers' debriefs); own = the caller's share. Aggregate only.
    flagCount,
  };
}

// ── GET /candidates ───────────────────────────────────────────────────────
// Org-scoped list. RLS scopes rows to the manager's org. Soft-deleted
// candidates (deletedAt: not null) are filtered out. Returns the enriched
// shape used by the candidates page; the upload-form picker ignores the
// extra fields. canModify is per-row: true if this manager has at least one
// MeetingCandidate link for the candidate.
candidatesRouter.get('/', async (req, res) => {
  const { candidates, counts } = await withManagerContext(req.manager.id, async (tx) => {
    const candidates = await tx.candidate.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        roleAppliedFor: true,
        createdAt: true,
        demographics: true,
        _count: { select: { meetings: true } },
        decisions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { outcome: true, meeting: { select: { meetingType: true } } },
        },
        // meetings here is the MeetingCandidate join; presence of any row
        // owned by the caller's manager id is what drives canModify.
        meetings: {
          where: { meeting: { managerId: req.manager.id } },
          take: 1,
          select: { meetingId: true },
        },
      },
    });

    // Org-wide per-candidate flag counts (incl. other managers'). Read from
    // the SECURITY DEFINER aggregate function inside the same context tx — the
    // RLS-scoped includes above only ever see the caller's own flags.
    const counts = await tx.$queryRaw<
      Array<{ candidate_id: string; total: bigint; own: bigint }>
    >`SELECT candidate_id, total, own FROM candidate_flag_counts()`;

    return { candidates, counts };
  });

  const countById = new Map(
    counts.map((c) => [c.candidate_id, { total: Number(c.total), own: Number(c.own) }]),
  );

  res.json(candidates.map((row) => toWireCandidate(row, countById.get(row.id))));
});

// ── GET /candidates/:id/flags ─────────────────────────────────────────────
// The caller's OWN flags for one candidate, with full content (type, excerpt,
// reasoning, confidence). This is deliberately different from the org-wide
// `flagCount` on the list: that count crosses the manager boundary as an
// aggregate, whereas this returns flag *content* — so it is scoped strictly to
// the caller's own debriefs. RLS already limits `flags` SELECT to the caller's
// own meetings (managers_select_own_flags); the meeting→candidate filter
// narrows to this candidate. A candidate the caller hasn't interviewed simply
// yields an empty list — never another manager's flag content. No ownership
// middleware needed: the empty-list outcome *is* the correct boundary.
candidatesRouter.get('/:id/flags', async (req, res) => {
  const flags = await withManagerContext(req.manager.id, (tx) =>
    tx.flag.findMany({
      where: { meeting: { candidates: { some: { candidateId: req.params.id } } } },
      orderBy: [{ meeting: { date: 'desc' } }, { confidenceScore: 'desc' }],
      select: {
        id: true,
        flagType: true,
        excerpt: true,
        reasoning: true,
        confidenceScore: true,
        dismissed: true,
        meetingId: true,
        meeting: { select: { title: true, date: true, meetingType: true } },
      },
    }),
  );

  res.json(
    flags.map((f) => ({
      id: f.id,
      flagType: f.flagType,
      excerpt: f.excerpt,
      reasoning: f.reasoning,
      confidenceScore: f.confidenceScore,
      dismissed: f.dismissed,
      meetingId: f.meetingId,
      meetingTitle: f.meeting.title,
      meetingDate: f.meeting.date,
      meetingType: f.meeting.meetingType,
    })),
  );
});

// ── POST /candidates ──────────────────────────────────────────────────────
// Create a candidate scoped to the manager's org. orgId comes from the
// authenticated manager — never from the request body — so a forged orgId
// can't smuggle a candidate into another org. Demographics is optional at
// creation per Section 6 of the Week 4 plan; the composite-FK orgId on the
// nested demographics row is inferred by Prisma from the parent.
candidatesRouter.post('/', async (req, res) => {
  const parsed = createCandidateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, roleAppliedFor, demographics } = parsed.data;
  const demographicsCreate = demographics ? pickDefined(demographics) : null;

  const candidate = await withManagerContext(req.manager.id, async (tx) => {
    return tx.candidate.create({
      data: {
        name,
        roleAppliedFor,
        orgId: req.manager.orgId,
        ...(demographicsCreate
          ? { demographics: { create: demographicsCreate } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        roleAppliedFor: true,
        createdAt: true,
        demographics: true,
        _count: { select: { meetings: true } },
        decisions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { outcome: true, meeting: { select: { meetingType: true } } },
        },
        meetings: {
          where: { meeting: { managerId: req.manager.id } },
          take: 1,
          select: { meetingId: true },
        },
      },
    });
  });

  res.status(201).json(toWireCandidate(candidate));
});

// ── PATCH /candidates/:id ─────────────────────────────────────────────────
// Partial update. requireOwnership('candidate') gates writes to candidates
// the caller has actually interviewed (hybrid access — Section 5 of the
// plan). Demographics is upserted: the row is created lazily on first PATCH
// that touches a demographics field, updated otherwise. orgId for the
// nested demographics row is inferred from the parent candidate.
candidatesRouter.patch('/:id', requireOwnership('candidate'), async (req, res) => {
  const parsed = updateCandidateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, roleAppliedFor, demographics } = parsed.data;
  const demographicsPatch = demographics ? pickDefined(demographics) : null;

  const candidate = await withManagerContext(req.manager.id, async (tx) => {
    return tx.candidate.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(roleAppliedFor !== undefined ? { roleAppliedFor } : {}),
        ...(demographicsPatch
          ? {
              demographics: {
                upsert: {
                  create: demographicsPatch,
                  update: demographicsPatch,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        roleAppliedFor: true,
        createdAt: true,
        demographics: true,
        _count: { select: { meetings: true } },
        decisions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { outcome: true, meeting: { select: { meetingType: true } } },
        },
        meetings: {
          where: { meeting: { managerId: req.manager.id } },
          take: 1,
          select: { meetingId: true },
        },
      },
    });
  });

  res.json(toWireCandidate(candidate));
});

// ── DELETE /candidates/:id ────────────────────────────────────────────────
// Soft delete — sets deletedAt rather than removing the row, so linked
// Meeting/Flag/Decision history stays intact and the analysis trail isn't
// orphaned. requireOwnership('candidate') also gates this; a re-delete on
// an already-tombstoned candidate fails the ownership check (the check
// requires deletedAt: null) and returns 403, which is the expected
// semantic — the link is gone.
candidatesRouter.delete('/:id', requireOwnership('candidate'), async (req, res) => {
  await withManagerContext(req.manager.id, async (tx) => {
    await tx.candidate.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
  });

  res.status(204).end();
});
