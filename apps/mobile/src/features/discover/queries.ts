import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Mode } from '../modes';
import { fetchFeedPage, fetchMyDiscoverState, fetchProfile } from './api';

export const discoverKeys = {
  all: ['discover'],
  feed: (mode: Mode | null) => ['discover', 'feed', mode ?? 'all'],
  me: ['discover', 'me'],
  profile: (memberId: string) => ['discover', 'profile', memberId],
};

export function useMyDiscoverState(userId: string) {
  return useQuery({
    queryKey: discoverKeys.me,
    queryFn: () => fetchMyDiscoverState(userId),
  });
}

export function useFeed(mode: Mode | null) {
  return useInfiniteQuery({
    queryKey: discoverKeys.feed(mode),
    queryFn: ({ pageParam }) => fetchFeedPage({ mode, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor,
  });
}

export function useProfile(memberId: string) {
  return useQuery({
    queryKey: discoverKeys.profile(memberId),
    queryFn: () => fetchProfile(memberId),
  });
}
