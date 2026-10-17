import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { chatKeys } from '../chat/queries';
import {
  askToJoin,
  fetchActivity,
  fetchBoard,
  fetchJoined,
  fetchJoinRequests,
  fetchMyJoinRequests,
  respondJoinRequest,
  withdrawJoinRequest,
} from './api';
import type { BoardListing } from './model';

// All under 'activities', so invalidating `all` also refreshes both Join Request lists.
export const activityKeys = {
  all: ['activities'],
  board: ['activities', 'board'],
  joined: ['activities', 'joined'],
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
  });
}

const dayMs = 24 * 60 * 60_000;

// Drops each Activity when its time on the board is up, with one timer for the next to go.
export function useStillListed(listings: BoardListing[] | undefined) {
  const [now, setNow] = useState(Date.now);
  const next = listings
    ?.map(listing => Date.parse(listing.visibleUntil))
    .filter(until => until > now)
    .sort((a, b) => a - b)[0];
  useEffect(() => {
    if (next === undefined) {
      return;
    }
    // Capped at a day: longer timeouts overflow; waking early just sets the next one.
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(next - Date.now(), dayMs),
    );
    return () => clearTimeout(timer);
  }, [next, now]);
  return listings?.filter(listing => Date.parse(listing.visibleUntil) > now);
}

export function useJoined() {
  return useQuery({ queryKey: activityKeys.joined, queryFn: fetchJoined });
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
