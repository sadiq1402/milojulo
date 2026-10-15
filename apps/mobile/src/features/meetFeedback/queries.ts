import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPendingFeedback,
  hasAnswered,
  submitMeetFeedback,
  type MeetAnswer,
} from './api';

export const meetFeedbackKeys = {
  all: ['meet-feedback'],
  pending: ['meet-feedback', 'pending'],
  answered: (otherUserId: string) => ['meet-feedback', 'answered', otherUserId],
};

export function usePendingFeedback() {
  return useQuery({
    queryKey: meetFeedbackKeys.pending,
    queryFn: fetchPendingFeedback,
  });
}

export function useHasAnswered(otherUserId: string | undefined) {
  return useQuery({
    queryKey: meetFeedbackKeys.answered(otherUserId ?? ''),
    queryFn: () => hasAnswered(otherUserId!),
    enabled: !!otherUserId,
  });
}

// One answer per pair and Activity, so every "answered" view and the prompt list refresh after it.
export function useSubmitMeetFeedback() {
  const client = useQueryClient();
  return useMutation({
    // Wrapped: TanStack passes its context as a second argument.
    mutationFn: (answer: MeetAnswer) => submitMeetFeedback(answer),
    onSettled: () =>
      client.invalidateQueries({ queryKey: meetFeedbackKeys.all }),
  });
}
