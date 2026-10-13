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

// Everything sits under 'activities', so invalidating `all` refreshes the board, details and
// both join request lists at once.
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

// Only the host gets any rows, so the screen asks only when it is theirs.
export function useJoinRequests(activityId: string, enabled: boolean) {
  return useQuery({
    queryKey: activityKeys.joinRequests(activityId),
    queryFn: () => fetchJoinRequests(activityId),
    enabled,
  });
}

export function useMyJoinRequests() {
  return useQuery({
    queryKey: activityKeys.myJoinRequests,
    queryFn: fetchMyJoinRequests,
    // Join Requests aren't broadcast, so the Inbox badge and lists check now and then.
    refetchInterval: 30_000,
  });
}

// Spots, the board, both request lists and (on accept) the chat list all move together.
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
    onSuccess: refresh,
  });
}

// Resolves once the chat list holds the Activity Connection, so a chat opened next finds it.
export function useRespondJoinRequest() {
  const refresh = useRefreshAfterJoinChange();
  return useMutation({
    mutationFn: ({
      requestId,
      accept,
    }: {
      requestId: string;
      accept: boolean;
    }) => respondJoinRequest(requestId, accept),
    onSuccess: refresh,
  });
}

export function useWithdrawJoinRequest() {
  const refresh = useRefreshAfterJoinChange();
  return useMutation({
    mutationFn: (requestId: string) => withdrawJoinRequest(requestId),
    onSuccess: refresh,
  });
}
