import { Router } from 'express';
import {
  createCandidateBody,
  updateCandidateBody,
  type DemographicsInput,
} from '@fairhire/shared';
import { withManagerContext } from '../lib/prisma';
import { requireOwnership } from '../middleware/requireOwnership';

export const candidatesRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────

// Filter the demographics payload down to only the keys actually present on
// the wire. Lets PATCH submit a partial body and not clobber fields the
// caller didn't touch. Explicit `null` is preserved (caller wants to clear);
// `undefined` is dropped.
function pickDefined(input: DemographicsInput): DemographicsInput {
  const out: DemographicsInput = {};
  for (const [k, v] of Object.entries(input) as Array<
    [keyof DemographicsInput, DemographicsInput[keyof DemographicsInput]]
  >) {
    if (v !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[k] = v;
    }
  }
  return out;
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
  decisions: Array<{ outcome: 'hired' | 'rejected' | 'in_progress' }>;
  meetings: Array<{ meetingId: string }>;
}

function toWireCandidate(row: CandidateRowFromDb) {
  return {
    id: row.id,
    name: row.name,
    roleAppliedFor: row.roleAppliedFor,
    createdAt: row.createdAt,
    demographics: row.demographics,
    meetingCount: row._count.meetings,
    lastDecisionOutcome: row.decisions[0]?.outcome ?? null,
    canModify: row.meetings.length > 0,
  };
}

// ── GET /candidates ───────────────────────────────────────────────────────
// Org-scoped list. RLS scopes rows to the manager's org. Soft-deleted
// candidates (deletedAt: not null) are filtered out. Returns the enriched
// shape used by the candidates page; the upload-form picker ignores the
// extra fields. canModify is per-row: true if this manager has at least one
// MeetingCandidate link for the candidate.
candidatesRouter.get('/', async (req, res) => {
  const candidates = await withManagerContext(req.manager.id, async (tx) => {
    return tx.candidate.findMany({
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
          select: { outcome: true },
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
  });

  res.json(candidates.map(toWireCandidate));
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
          select: { outcome: true },
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
          select: { outcome: true },
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
