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

meetingsRouter.get('/:id', requireOwnership('meeting'), async (req, res) => {
  const meeting = await withManagerContext(req.manager.id, async (tx) => {
    return tx.meeting.findUnique({
      where: { id: req.params.id },
      include: {
        candidates: { include: candidateWithDemographics },
        flags: true,
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
