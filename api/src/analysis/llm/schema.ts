import { z } from 'zod';
import { FLAG_TYPES } from '@fairhire/shared';

export const FlagCandidateSchema = z.object({
  flagType: z.enum(FLAG_TYPES),
  excerpt: z.string().min(1),
  reasoning: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
  suggestedAlt: z.string().optional(),
});

export const LLMResponseSchema = z.object({
  flags: z.array(FlagCandidateSchema),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;
