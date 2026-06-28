import { useParams } from 'react-router-dom';
import { useAnalysisRun } from '../lib/useAnalysisRun';
import { FlagReviewScreen } from '../components/flag-review/FlagReviewScreen';
import { InlineError } from '../components/shared/primitives';

export default function FlagReview() {
  const { id } = useParams<{ id: string }>();
  const query = useAnalysisRun(id ?? '');

  if (!id) {
    return <p className="font-serif italic text-base text-ink-tertiary">No meeting selected.</p>;
  }
  if (query.isLoading) {
    return <p className="font-mono text-sm text-ink-tertiary">Loading meeting…</p>;
  }
  if (query.isError || !query.data) {
    return (
      <InlineError
        error={query.error}
        onRetry={() => void query.refetch()}
        fallback="Couldn’t load this meeting."
      />
    );
  }

  return <FlagReviewScreen meeting={query.data} />;
}
