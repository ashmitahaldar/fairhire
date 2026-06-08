import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { DecisionOutcome } from './flagReview';

// Single hook covering both "create decision for this (meeting, candidate)
// pair" and "patch the existing decision's outcome." The FlagReview decision
// panel calls this immediately on click — no submit button — so the same
// hook handles new and existing rows behind one API.

interface UpsertInput {
  /** Existing decision id, or null to create a new one. */
  decisionId: string | null;
  meetingId: string;
  candidateId: string;
  outcome: DecisionOutcome;
}

interface DecisionResponse {
  id: string;
  outcome: DecisionOutcome;
}

export function useUpsertDecision() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation<DecisionResponse, Error, UpsertInput>({
    mutationFn: async ({ decisionId, meetingId, candidateId, outcome }) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      if (decisionId) {
        // PATCH only sends the changed field; the api's updateBody schema
        // accepts outcome on its own.
        return apiFetch<DecisionResponse>(`/decisions/${decisionId}`, token, {
          method: 'PATCH',
          body: JSON.stringify({ outcome }),
        });
      }
      return apiFetch<DecisionResponse>('/decisions', token, {
        method: 'POST',
        body: JSON.stringify({ meetingId, candidateId, outcome }),
      });
    },
    onSuccess: (_data, vars) => {
      // The meeting query carries the decision into the FlagReview view-model.
      void qc.invalidateQueries({ queryKey: ['meeting', vars.meetingId] });
      // Recording an outcome shifts pipeline composition (Phase C) and the
      // decisions-skewing nudge (Phase D); also bumps lastDecisionOutcome
      // on the candidates list.
      void qc.invalidateQueries({ queryKey: ['mirror'] });
      void qc.invalidateQueries({ queryKey: ['candidates'] });
    },
  });
}
