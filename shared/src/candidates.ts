import { z } from 'zod';
import {
  ageBandSchema,
  genderSchema,
  nationalityStatusSchema,
  raceSchema,
} from './types';

// ── Demographics payload ───────────────────────────────────────────────────
// Every field is nullable + optional. The Week 4 add-candidate modal
// treats them all as optional at creation; PATCH callers send only the
// fields they're changing. Explicit null clears a previously-set value;
// undefined leaves it alone. The server upserts a CandidateDemographics
// row using these inputs (lazy create on first PATCH that touches a
// demographics field).

const trimmedStr = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const nonNegInt = z.number().int().nonnegative().nullable().optional();

export const demographicsInput = z.object({
  // protected / legal-class
  race: raceSchema.nullable().optional(),
  gender: genderSchema.nullable().optional(),
  ageBand: ageBandSchema.nullable().optional(),
  nationalityStatus: nationalityStatusSchema.nullable().optional(),

  // self-reported background
  firstLanguage: trimmedStr(255),
  yearsInSingapore: nonNegInt,
  university: trimmedStr(255),
  major: trimmedStr(255),
  previousEmployer: trimmedStr(255),
  yearsExperience: nonNegInt,
  currentBase: trimmedStr(255),
});

export type DemographicsInput = z.infer<typeof demographicsInput>;

// ── Candidate create / update bodies ───────────────────────────────────────
// name + roleAppliedFor required at creation per Section 6. orgId is
// resolved from req.manager.orgId on the server and never crosses the
// wire. Both bodies accept a nested demographics object; the server
// runs Prisma nested create on POST and upsert on PATCH.

export const createCandidateBody = z.object({
  name: z.string().trim().min(1).max(255),
  roleAppliedFor: z.string().trim().min(1).max(255),
  demographics: demographicsInput.optional(),
});

export type CreateCandidateInput = z.infer<typeof createCandidateBody>;

export const updateCandidateBody = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  roleAppliedFor: z.string().trim().min(1).max(255).optional(),
  demographics: demographicsInput.optional(),
});

export type UpdateCandidateInput = z.infer<typeof updateCandidateBody>;
