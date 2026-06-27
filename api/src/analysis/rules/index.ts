import type { MeetingType } from '@fairhire/shared';
import { AsymmetricConcernRule } from './AsymmetricConcernRule';
import { HedgingLanguageRule } from './HedgingLanguageRule';
import { AgeBiasRule } from './AgeBiasRule';
import { CriteriaDriftRule } from './CriteriaDriftRule';
import { PotentialVsPerformanceRule } from './PotentialVsPerformanceRule';
import { TenureFramingRule } from './TenureFramingRule';
import { PeerComparisonBiasRule } from './PeerComparisonBiasRule';
import { ConfidenceProxyRule } from './ConfidenceProxyRule';
import type { Rule } from './Rule';

// Hiring-mode ruleset. The original four — these are written for
// hiring-interview language and don't generalise cleanly to promotion
// discussions, so they don't fire on promotion meetings.
const HIRING_RULES: Rule[] = [
  new AsymmetricConcernRule(),
  new HedgingLanguageRule(),
  new AgeBiasRule(),
  new CriteriaDriftRule(),
];

// Promotion-mode ruleset. Added in Week 5 — each targets a documented
// promotion-decisioning failure mode (potential-over-performance,
// tenure-as-rationale, named-peer comparison, confidence-as-proxy).
const PROMOTION_RULES: Rule[] = [
  new PotentialVsPerformanceRule(),
  new TenureFramingRule(),
  new PeerComparisonBiasRule(),
  new ConfidenceProxyRule(),
];

// Returns the rules that should fire for a given meeting's mode.
// RulesEngine consumes this; HybridRouter forwards `meetingType` from
// runAnalysis. Tests can also call it directly to assert on a mode's
// ruleset shape.
export function getRulesForMode(meetingType: MeetingType): Rule[] {
  return meetingType === 'promotion' ? PROMOTION_RULES : HIRING_RULES;
}

// Back-compat export — the eval framework and some older tests still
// import ALL_RULES expecting the union of every rule. Kept until the
// eval pipeline is mode-aware (Step 8).
export const ALL_RULES: Rule[] = [...HIRING_RULES, ...PROMOTION_RULES];
