import { useParams } from 'react-router-dom';
import { useAnalysisRun } from '../lib/useAnalysisRun';
import { FlagReviewScreen } from '../components/flag-review/FlagReviewScreen';

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
      <p className="font-mono text-sm text-ink-secondary">
        Couldn’t load this meeting.{' '}
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="text-ink font-medium hover:text-accent transition-colors duration-120"
        >
          Retry
        </button>
      </p>
    );
  }

  return <FlagReviewScreen meeting={query.data} />;
}
