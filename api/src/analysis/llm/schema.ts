import { z } from 'zod';
import { FlagCandidateSchema } from '../types';

// Shape of the JSON object the LLM returns. The flag shape itself is owned
// by analysis/types.ts so the LLM contract and the /internal callback
// contract cannot drift apart.
export const LLMResponseSchema = z.object({
  flags: z.array(FlagCandidateSchema),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;
