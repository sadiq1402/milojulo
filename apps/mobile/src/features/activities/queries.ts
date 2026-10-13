import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '../chat/queries';
import {
  askToJoin,
  fetchActivity,
  fetchBoard,
  fetchJoinRequests,
  fetchMyJoinRequests,
  respondJoinRequest,
  withdrawJoinRequest,
} from './api';

// All under 'activities', so invalidating `all` also refreshes both Join Request lists.
export const activityKeys = {
  all: ['activities'],
  board: ['activities', 'board'],
  detail: (activityId: string) => ['activities', 'detail', activityId],
  joinRequests: (activityId: string) => [
    'activities',
    'join-requests',
    activityId,
  ],
  myJoinRequests: ['activities', 'my-join-requests'],
};

export function useBoard() {
  return useQuery({
    queryKey: activityKeys.board,
    queryFn: fetchBoard,
    // Activities end while the board is open; the database hides them, so check now and then.
    refetchInterval: 60_000,
  });
}

export function useActivity(activityId: string) {
  return useQuery({
    queryKey: activityKeys.detail(activityId),
    queryFn: () => fetchActivity(activityId),
  });
}

// The host's view; anyone else gets no rows.
export function useJoinRequests(activityId: string) {
  return useQuery({
    queryKey: activityKeys.joinRequests(activityId),
    queryFn: () => fetchJoinRequests(activityId),
  });
}

export function useMyJoinRequests() {
  return useQuery({
    queryKey: activityKeys.myJoinRequests,
    queryFn: fetchMyJoinRequests,
    // Join Requests aren't broadcast, so the Inbox badge polls.
    refetchInterval: 30_000,
  });
}

// Refreshes after a refusal too, since a refusal often means the Activity changed.
function useRefreshAfterJoinChange() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: activityKeys.all }),
      client.invalidateQueries({ queryKey: chatKeys.conversations }),
    ]);
}

export function useAskToJoin(activityId: string) {
  const refresh = useRefreshAfterJoinChange();
  return useMutation({
    mutationFn: () => askToJoin(activityId),
    onSettled: refresh,
  });
}

// onAccepted runs here, not in mutate(), so it still runs once the answered card has unmounted.
export function useRespondJoinRequest(
  onAccepted?: (connectionId: string) => void,
) {
  const refresh = useRefreshAfterJoinChange();
  return useMutation({
    mutationFn: ({
      requestId,
      accept,
    }: {
      requestId: string;
      accept: boolean;
    }) => respondJoinRequest(requestId, accept),
    onError: refresh,
    onSuccess: async connectionId => {
      // The chat reads its Connection from the chat list, so wait for it first.
      await refresh();
      if (connectionId) {
        onAccepted?.(connectionId);
      }
    },
  });
}

export function useWithdrawJoinRequest() {
  const refresh = useRefreshAfterJoinChange();
  return useMutation({
    mutationFn: (requestId: string) => withdrawJoinRequest(requestId),
    onSettled: refresh,
  });
}
