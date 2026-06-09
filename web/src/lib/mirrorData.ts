// Thin re-export of the Pattern Mirror types from @fairhire/shared. The
// page now reads real data via usePatternMirror; the previous LCG mock
// generator that lived here is gone. Kept as a file (rather than
// rewriting every import) because half a dozen mirror components reference
// it and the indirection is cheap.
//
// `DecisionOutcome` here means the display-vocabulary used by the Mirror
// (Hired / Declined / Pending — the labels rendered on screen), not the
// schema enum (lowercase). Aliased from MirrorDecisionOutcome to keep
// existing call sites compiling.

export type {
  MirrorData,
  MirrorManager,
  MirrorSummary,
  MirrorDecision,
  MirrorDecisionOutcome as DecisionOutcome,
  LanguageFlagRow,
  MirrorNudge,
  PipelineRow,
  RaceSegmentKey,
} from '@fairhire/shared';

export { RACE_SEGMENT_KEYS } from '@fairhire/shared';
