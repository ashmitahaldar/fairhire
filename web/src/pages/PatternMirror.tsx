import { useState } from 'react';
import type { MeetingType, MirrorPeriod } from '@fairhire/shared';
import { PatternMirrorScreen } from '../components/pattern-mirror/PatternMirrorScreen';
import { usePatternMirror } from '../lib/usePatternMirror';
import { ChartSkeleton, InlineError, Skeleton } from '../components/shared/primitives';

// Maps the TimeRangeSelector's display labels (the canonical user-facing
// strings emitted by the server in MirrorData.periodOptions) back to the
// canonical MirrorPeriod keys the api accepts on ?period=. Lives here
// because it's the only consumer; promote to shared if a second
// consumer appears.
const LABEL_TO_KEY: Record<string, MirrorPeriod> = {
  'Last 30 days': '30d',
  'Last 90 days': '90d',
  'Last 12 months': '12m',
};

export default function PatternMirror() {
  const [period, setPeriod] = useState<MirrorPeriod>('90d');
  const [meetingType, setMeetingType] = useState<MeetingType>('hiring');
  const query = usePatternMirror(period, meetingType);

  if (query.isLoading) {
    return (
      <div className="max-w-mirror mx-auto pt-10" role="status" aria-live="polite">
        <span className="sr-only">Loading your patterns…</span>
        <Skeleton className="h-4 w-40 mb-3" />
        <Skeleton className="h-8 w-80 mb-10" />
        <ChartSkeleton />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="max-w-mirror mx-auto pt-10">
        <InlineError
          error={query.error}
          onRetry={() => void query.refetch()}
          fallback="Couldn’t load Pattern Mirror."
        />
      </div>
    );
  }

  if (!query.data) return null;

  return (
    <PatternMirrorScreen
      data={query.data}
      meetingType={meetingType}
      onMeetingTypeChange={setMeetingType}
      onPeriodChange={(label) => {
        const key = LABEL_TO_KEY[label];
        if (key) setPeriod(key);
      }}
    />
  );
}
