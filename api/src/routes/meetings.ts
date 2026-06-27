import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { createMeetingBody } from '@fairhire/shared';
import { withManagerContext } from '../lib/prisma';
import { requireOwnership } from '../middleware/requireOwnership';
import { runAnalysis } from '../analysis/analyseTranscript';

export const meetingsRouter = Router();

// Candidate rows include their 1:1 demographics; shared so the three meeting
// queries below stay consistent.
const candidateWithDemographics = Prisma.validator<Prisma.MeetingCandidateInclude>()({
  candidate: { include: { demographics: true } },
});

meetingsRouter.get('/', async (req, res) => {
  const meetings = await withManagerContext(req.manager.id, async (tx) => {
    return tx.meeting.findMany({
      where: { managerId: req.manager.id },
      // Explicit select so the list payload doesn't drag the full transcript
      // along for every row (it's typically the heaviest field, the Dashboard
      // never reads it). Full transcript lives on GET /:id.
      select: {
        id: true,
        orgId: true,
        managerId: true,
        title: true,
        transcriptFilename: true,
        date: true,
        meetingType: true,
        createdAt: true,
        updatedAt: true,
        candidates: { include: candidateWithDemographics },
        // Flag count and latest run status so the Dashboard list renders
        // without N+1 followups; full flag rows live on GET /:id.
        _count: { select: { flags: true } },
        analysisRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true },
        },
      },
      orderBy: { date: 'desc' },
    });
  });
  res.json(meetings);
});

meetingsRouter.post('/', async (req, res) => {
  const parsed = createMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const body = parsed.data;
  const { title, transcript, transcriptFilename, date, candidateIds, meetingType } = body;

  const { meeting, runId } = await withManagerContext(req.manager.id, async (tx) => {
    const m = await tx.meeting.create({
      data: {
        title,
        transcript,
        transcriptFilename,
        date: new Date(date),
        meetingType,
        managerId: req.manager.id,
        orgId: req.manager.orgId,
        candidates: {
          create: candidateIds.map((candidateId) => ({ candidateId })),
        },
      },
      include: { candidates: { include: candidateWithDemographics } },
    });

    // Promotion mode persists currentRole / tenureYears / lastPromotedAt
    // onto the FIRST candidate row. Section 3 of the Week 5 plan reuses
    // Candidate for the promotion target (one candidate per promotion
    // meeting in practice). The upload form will enforce singleton
    // selection on the Promotion tab; we update the first id either way
    // so the data lands somewhere predictable if a future surface ever
    // sends more.
    if (body.meetingType === 'promotion') {
      await tx.candidate.update({
        where: { id: candidateIds[0] },
        data: {
          currentRole: body.currentRole,
          tenureYears: body.tenureYears,
          lastPromotedAt: body.lastPromotedAt ? new Date(body.lastPromotedAt) : null,
        },
      });
    }

    const run = await tx.analysisRun.create({
      data: { meetingId: m.id, orgId: req.manager.orgId, status: 'pending' },
    });
    return { meeting: m, runId: run.id };
  });

  res.status(201).json(meeting);

  setImmediate(() => {
    runAnalysis(runId).catch((err) => {
      console.error('[analysis] unhandled error for run', runId, err);
    });
  });
});

// Re-run analysis on a meeting. Used by the Flag Review re-run button
// (and, by extension, the failed-state Retry path). Wipes existing flags
// for a fresh run — there's no Flag.runId yet, so the UI shows a
// confirm-and-discard modal client-side before calling this so any
// dismissals the manager has made don't disappear silently.
//
// The wipe + new AnalysisRun + setImmediate happens inside one transaction
// so a partial state (flags deleted but no new run) can't be observed.
// FlagSpan rows cascade off Flag, so we only need to delete flags.
meetingsRouter.post('/:id/analyse', requireOwnership('meeting'), async (req, res) => {
  const meetingId = req.params.id;
  const { runId, started } = await withManagerContext(req.manager.id, async (tx) => {
    // Guard against a re-run while one is already in flight (e.g. a
    // double-click in the window between the 202 and the meeting refetch
    // hiding the button). Each re-run creates a distinct AnalysisRun, and
    // runAnalysis only claims its own run by id — so two concurrent runs
    // would both analyse and both persist flags, doubling the flag set.
    // If a pending/running run already exists, return it untouched rather
    // than wiping flags and starting another.
    const active = await tx.analysisRun.findFirst({
      where: { meetingId, status: { in: ['pending', 'running'] } },
      select: { id: true },
    });
    if (active) return { runId: active.id, started: false };

    await tx.flag.deleteMany({ where: { meetingId } });
    const run = await tx.analysisRun.create({
      data: { meetingId, orgId: req.manager.orgId, status: 'pending' },
    });
    return { runId: run.id, started: true };
  });

  // 202 either way — "analysis is (now / already) in progress." The client
  // refetches the meeting and picks up the in-flight run's status.
  res.status(202).json({ runId });

  // Only schedule when this request actually created the run; an in-flight
  // run is already being processed by its original scheduling.
  if (started) {
    setImmediate(() => {
      runAnalysis(runId).catch((err) => {
        console.error('[analysis] unhandled error for re-run', runId, err);
      });
    });
  }
});

meetingsRouter.get('/:id', requireOwnership('meeting'), async (req, res) => {
  const meeting = await withManagerContext(req.manager.id, async (tx) => {
    return tx.meeting.findUnique({
      where: { id: req.params.id },
      include: {
        candidates: { include: candidateWithDemographics },
        // Each flag carries its FlagSpan rows so the client can render
        // every occurrence (multi-instance highlighting + Found-in-N
        // affordance from Section 1 of the Week 5 plan). Sorted by
        // startOffset so consumers don't have to.
        flags: {
          include: {
            spans: {
              orderBy: { startOffset: 'asc' },
              select: { id: true, startOffset: true, endOffset: true },
            },
          },
        },
        analysisRuns: { orderBy: { createdAt: 'desc' }, take: 1 },
        // Decisions recorded against this meeting (by this manager via
        // RLS). The Flag Review screen surfaces the current outcome
        // per candidate so the manager can record/change a decision
        // without leaving the page.
        decisions: {
          select: { id: true, candidateId: true, outcome: true },
        },
      },
    });
  });
  res.json(meeting);
});
