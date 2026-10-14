import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCircle,
  fetchCircleActivities,
  fetchCircleMembers,
  fetchCircles,
  joinCircle,
  leaveCircle,
} from './api';

export const circleKeys = {
  all: ['circles'],
  list: ['circles', 'list'],
  detail: (circleId: string) => ['circles', 'detail', circleId],
  members: (circleId: string) => ['circles', 'members', circleId],
  activities: (circleId: string) => ['circles', 'activities', circleId],
};

export function useCircles() {
  return useQuery({ queryKey: circleKeys.list, queryFn: fetchCircles });
}

export function useCircle(circleId: string) {
  return useQuery({
    queryKey: circleKeys.detail(circleId),
    queryFn: () => fetchCircle(circleId),
  });
}

// Empty unless I'm a member of the Circle.
export function useCircleMembers(circleId: string) {
  return useQuery({
    queryKey: circleKeys.members(circleId),
    queryFn: () => fetchCircleMembers(circleId),
  });
}

export function useCircleActivities(circleId: string) {
  return useQuery({
    queryKey: circleKeys.activities(circleId),
    queryFn: () => fetchCircleActivities(circleId),
  });
}

// Joining or leaving changes the list, the Circle and its members (fellow members only
// show to members); the Activity board is untouched, so only the Circle queries refresh.
function useRefreshCircles() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: circleKeys.all });
}

export function useJoinCircle(circleId: string) {
  const refresh = useRefreshCircles();
  return useMutation({
    mutationFn: () => joinCircle(circleId),
    onSettled: refresh,
  });
}

export function useLeaveCircle(circleId: string) {
  const refresh = useRefreshCircles();
  return useMutation({
    mutationFn: () => leaveCircle(circleId),
    onSettled: refresh,
  });
}
