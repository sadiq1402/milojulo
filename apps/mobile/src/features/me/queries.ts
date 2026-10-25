import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { activityKeys } from '../activities/queries';
import { blockMember } from '../chat/api';
import { chatKeys } from '../chat/queries';
import { circleKeys } from '../circles/queries';
import { discoverKeys } from '../discover/queries';
import { meetFeedbackKeys } from '../meetFeedback/queries';
import { useMyPhotos } from '../photos/queries';
import { useProfileDraft } from '../profileSetup/queries';
import { fetchMyBlocks, setPaused, unblock } from './api';

export const blocksKey = ['my-blocks'];

const refresh = (client: QueryClient, keys: readonly string[][]) =>
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

// A Block hides both Members from each other everywhere, and these lists are kept on
// the phone between launches (decision 52), so every one of them has to be refreshed.
const listsABlockChanges = [
  blocksKey,
  discoverKeys.all,
  chatKeys.conversations,
  chatKeys.stateAll,
  activityKeys.all,
  circleKeys.all,
  meetFeedbackKeys.all,
];

// The one Block action (#188): Chat, Profile and Report all block through this, so a Block
// leaves the same lists refreshed wherever it was made. Screens keep only their own
// navigation and messages. It throws the Block's own message when the Block fails, and
// only then: refetching is left running, since the screens leave as soon as the Block is
// through, and an invalidation never fails (TanStack swallows refetch errors).
export async function blockAndRefresh(
  client: QueryClient,
  memberId: string,
): Promise<void> {
  await blockMember(memberId);
  refresh(client, listsABlockChanges);
}

export function useMyBlocks() {
  return useQuery({ queryKey: blocksKey, queryFn: fetchMyBlocks });
}

export function useUnblock() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => unblock(memberId),
    onSuccess: () => refresh(client, listsABlockChanges),
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
