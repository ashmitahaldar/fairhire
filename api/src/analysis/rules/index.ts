import { AsymmetricConcernRule } from './AsymmetricConcernRule';
import { HedgingLanguageRule } from './HedgingLanguageRule';
import { AgeBiasRule } from './AgeBiasRule';
import { CriteriaDriftRule } from './CriteriaDriftRule';
import type { Rule } from './Rule';

export const ALL_RULES: Rule[] = [
  new AsymmetricConcernRule(),
  new HedgingLanguageRule(),
  new AgeBiasRule(),
  new CriteriaDriftRule(),
];
