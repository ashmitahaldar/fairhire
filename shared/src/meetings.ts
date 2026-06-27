import { z } from 'zod';
import { meetingTypeSchema } from './types';

// Wire payload for POST /meetings. Discriminated on `meetingType` so the
// promotion-only fields (current role/level, tenure, last promotion
// date) are required by the type checker only when the mode is
// promotion. Hiring stays exactly as it was pre-Week-5.
//
// Promotion fields are persisted onto the Candidate row pointed to by
// the first id in `candidateIds` (Section 3 of the Week 5 plan reuses
// the Candidate row for both modes — the promotion target IS a
// candidate where roleAppliedFor is the target level/role). The route
// nests-updates the candidate with these values when present.

const baseFields = {
  title: z.string().trim().min(1),
  transcript: z.string().trim().min(1).max(500_000),
  transcriptFilename: z.string().min(1).max(255).optional(),
  date: z.string().datetime(),
  candidateIds: z.array(z.string().uuid()).min(1),
};

export const hiringMeetingBody = z.object({
  ...baseFields,
  meetingType: z.literal('hiring'),
});
export type HiringMeetingBody = z.infer<typeof hiringMeetingBody>;

// `currentRole` is the employee's role today; `roleAppliedFor` on the
// Candidate captures the target. `tenureYears` is years at the company;
// `lastPromotedAt` is optional.
export const promotionMeetingBody = z.object({
  ...baseFields,
  meetingType: z.literal('promotion'),
  currentRole: z.string().trim().min(1).max(255),
  tenureYears: z.number().int().min(0).max(60),
  lastPromotedAt: z.string().datetime().optional(),
});
export type PromotionMeetingBody = z.infer<typeof promotionMeetingBody>;

// Pre-Week-5 callers don't send meetingType. We treat absence as
// `hiring` for back-compat: the front-end upload flow will start
// sending it explicitly once Step 5 wires the tab UI, but third-party
// scripts and direct curls continue to work without a body change.
// The transform fills in the default before discrimination so the
// resulting parsed object is always typed and the route has nothing
// special to handle.
export const createMeetingBody = z
  .object({ meetingType: meetingTypeSchema.optional() })
  .passthrough()
  .transform((v) => ({ ...v, meetingType: v.meetingType ?? 'hiring' }))
  .pipe(z.discriminatedUnion('meetingType', [hiringMeetingBody, promotionMeetingBody]));

export type CreateMeetingBody = z.infer<typeof createMeetingBody>;
