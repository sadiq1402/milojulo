import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { Mode } from '../modes';
import {
  fetchFeedPage,
  fetchMyDiscoverState,
  fetchProfile,
  saveRange,
  type DiscoverState,
} from './api';
import type { RangeKm } from './range';

export const discoverKeys = {
  all: ['discover'],
  feeds: ['discover', 'feed'],
  feed: (modes: Mode[], rangeKm: RangeKm | null) => [
    'discover',
    'feed',
    [...modes].sort(),
    rangeKm ?? 'anywhere',
  ],
  me: ['discover', 'me'],
  profile: (memberId: string) => ['discover', 'profile', memberId],
};

export function useMyDiscoverState(userId: string) {
  return useQuery({
    queryKey: discoverKeys.me,
    queryFn: () => fetchMyDiscoverState(userId),
  });
}

// The range is in the key so a new range starts a fresh feed.
export function useFeed(modes: Mode[], rangeKm: RangeKm | null) {
  return useInfiniteQuery({
    queryKey: discoverKeys.feed(modes, rangeKm),
    queryFn: ({ pageParam }) => fetchFeedPage({ modes, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor,
  });
}

export function useSaveRange(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (rangeKm: RangeKm | null) => saveRange(userId, rangeKm),
    onSuccess: (_, rangeKm) => {
      client.setQueryData<DiscoverState>(discoverKeys.me, state =>
        state ? { ...state, rangeKm } : state,
      );
    },
  });
}

export function useProfile(memberId: string) {
  return useQuery({
    queryKey: discoverKeys.profile(memberId),
    queryFn: () => fetchProfile(memberId),
  });
}
