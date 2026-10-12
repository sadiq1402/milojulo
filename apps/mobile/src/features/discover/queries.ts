import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  fetchAreaNames,
  fetchPromptQuestions,
  fetchTagNames,
} from '../catalog/api';
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

// Catalogs change only with a release, so they load once.
export function useAreaNames() {
  return useQuery({
    queryKey: ['areas'],
    queryFn: fetchAreaNames,
    staleTime: Infinity,
  });
}

export function useTagNames() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: fetchTagNames,
    staleTime: Infinity,
  });
}

export function usePromptQuestions() {
  return useQuery({
    queryKey: ['prompt-questions'],
    queryFn: fetchPromptQuestions,
    staleTime: Infinity,
  });
}
