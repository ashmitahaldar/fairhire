import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

// Set or clear the dismissed state on a flag. The Week-4 schema persists
// dismissed/dismissReason/dismissedAt/dismissedBy on the Flag row; the
// PATCH route handles both directions (Week 5 widened it). This hook
// fires the request and invalidates the meeting query so the screen
// re-projects from the canonical server state on reload.
//
// Caller's local UI state (the dismissed set, the reasons map) should
// optimistically mirror the dispatched action; the meeting query
// re-render reconciles the truth a moment later.

type SetArgs =
  | { flagId: string; dismissed: true; dismissReason: string }
  | { flagId: string; dismissed: false };

interface FlagResponseRow {
  id: string;
  dismissed: boolean;
  dismissReason: string | null;
}

export function useSetFlagDismissed(meetingId: string) {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation<FlagResponseRow, Error, SetArgs>({
    mutationFn: async (args) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const body = args.dismissed
        ? { dismissed: true, dismissReason: args.dismissReason }
        : { dismissed: false };
      return apiFetch<FlagResponseRow>(`/flags/${args.flagId}`, token, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      // The meeting query carries the flag rows into the FlagReview VM —
      // refetch so dismissed state is the server truth on the next render.
      void qc.invalidateQueries({ queryKey: ['meeting', meetingId] });
      // Dismissed totals feed Phase D nudges + the summary panel.
      void qc.invalidateQueries({ queryKey: ['mirror'] });
    },
  });
}
