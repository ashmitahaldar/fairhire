import type { FlagType } from '@fairhire/shared';

export interface FlagCandidate {
  flagType: FlagType;
  excerpt: string;
  reasoning: string;
  confidenceScore: number;
  suggestedAlt?: string;
}
