import { useState } from 'react';
import type { MirrorPeriod } from '@fairhire/shared';
import { PatternMirrorScreen } from '../components/pattern-mirror/PatternMirrorScreen';
import { usePatternMirror } from '../lib/usePatternMirror';

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
  const query = usePatternMirror(period);

  if (query.isLoading) {
    return (
      <div className="max-w-mirror mx-auto pt-10">
        <p className="font-mono text-sm text-ink-tertiary">Loading your patterns…</p>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="max-w-mirror mx-auto pt-10">
        <p className="font-mono text-sm text-ink-secondary">
          Couldn’t load Pattern Mirror.{' '}
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="text-ink font-medium hover:text-accent transition-colors duration-120"
          >
            Retry
          </button>
        </p>
      </div>
    );
  }

  if (!query.data) return null;

  return (
    <PatternMirrorScreen
      data={query.data}
      onPeriodChange={(label) => {
        const key = LABEL_TO_KEY[label];
        if (key) setPeriod(key);
      }}
    />
  );
}
