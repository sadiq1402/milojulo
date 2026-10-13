import { useQuery } from '@tanstack/react-query';
import { fetchActivity, fetchBoard } from './api';

export const activityKeys = {
  all: ['activities'],
  board: ['activities', 'board'],
  detail: (activityId: string) => ['activities', 'detail', activityId],
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
