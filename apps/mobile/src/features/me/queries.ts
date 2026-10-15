import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { activityKeys } from '../activities/queries';
import { chatKeys } from '../chat/queries';
import { circleKeys } from '../circles/queries';
import { discoverKeys } from '../discover/queries';
import { useMyPhotos } from '../photos/queries';
import { useProfileDraft } from '../profileSetup/queries';
import { fetchMyBlocks, setPaused, unblock } from './api';

export const blocksKey = ['my-blocks'];

const refresh = (client: QueryClient, keys: string[][]) =>
  Promise.all(keys.map(queryKey => client.invalidateQueries({ queryKey })));

// Being Paused empties Discover, the board and Circles.
export function useSetPaused() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (paused: boolean) => setPaused(paused),
    onSuccess: () =>
      refresh(client, [discoverKeys.all, activityKeys.all, circleKeys.all]),
  });
}

export function useMyBlocks() {
  return useQuery({ queryKey: blocksKey, queryFn: fetchMyBlocks });
}

export function useUnblock() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => unblock(memberId),
    onSuccess: () =>
      refresh(client, [
        blocksKey,
        discoverKeys.all,
        activityKeys.all,
        circleKeys.all,
        chatKeys.conversations,
      ]),
  });
}

// The own profile draft and photos, loaded together for Me and its edit screen.
export function useOwnProfile(userId: string) {
  const draft = useProfileDraft(userId);
  const photos = useMyPhotos();
  return {
    draft: draft.data,
    photos: photos.data,
    isError: draft.isError || photos.isError,
    retry: () => {
      draft.refetch();
      photos.refetch();
    },
  };
}
