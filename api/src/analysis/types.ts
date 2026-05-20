import { z } from 'zod';
import { FLAG_TYPES } from '@fairhire/shared';

// Single source of truth for the FlagCandidate shape. Every consumer — the
// LLM response validator, the /internal endpoint body validator, and the
// rules engine's typed output — comes from here, so the contract cannot
// drift across the two write paths.
export const FlagCandidateSchema = z.object({
  flagType: z.enum(FLAG_TYPES),
  excerpt: z.string().min(1),
  reasoning: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
  suggestedAlt: z.string().optional(),
});

export type FlagCandidate = z.infer<typeof FlagCandidateSchema>;
