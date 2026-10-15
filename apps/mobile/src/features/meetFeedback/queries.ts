import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPendingFeedback, hasAnswered, submitMeetFeedback } from './api';

export const meetFeedbackKeys = {
  all: ['meet-feedback'],
  pending: ['meet-feedback', 'pending'],
  answered: (otherUserId: string, activityId?: string) => [
    'meet-feedback',
    'answered',
    otherUserId,
    activityId ?? null,
  ],
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
    mutationFn: (answer: Parameters<typeof submitMeetFeedback>[0]) =>
      submitMeetFeedback(answer),
    onSettled: () =>
      client.invalidateQueries({ queryKey: meetFeedbackKeys.all }),
  });
}
