import { useQuery } from '@tanstack/react-query';
import { fetchActivity, fetchBoard } from './api';

export const activityKeys = {
  all: ['activities'],
  board: ['activities', 'board'],
  detail: (activityId: string) => ['activities', 'detail', activityId],
};

export function useBoard() {
  return useQuery({ queryKey: activityKeys.board, queryFn: fetchBoard });
}

export function useActivity(activityId: string) {
  return useQuery({
    queryKey: activityKeys.detail(activityId),
    queryFn: () => fetchActivity(activityId),
  });
}
