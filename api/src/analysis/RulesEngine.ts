import type { MeetingType } from '@fairhire/shared';
import { getRulesForMode } from './rules/index';
import type { FlagCandidate } from './types';

// Mode-aware. Hiring meetings get the hiring rules; promotion meetings
// get the promotion rules. The default is 'hiring' so callers that
// don't carry a mode (eval pipeline, legacy tests) keep the pre-Week-5
// behaviour.
export class RulesEngine {
  run(transcript: string, meetingType: MeetingType = 'hiring'): FlagCandidate[] {
    return getRulesForMode(meetingType).flatMap((rule) => rule.match(transcript));
  }
}
