import { ALL_RULES } from './rules/index';
import type { FlagCandidate } from './types';

export class RulesEngine {
  run(transcript: string): FlagCandidate[] {
    return ALL_RULES.flatMap((rule) => rule.match(transcript));
  }
}
