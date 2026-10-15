import { useQuery } from '@tanstack/react-query';
import { fetchConversations, type Message } from './api';
import { fetchMediaState, fetchMediaUrls } from './media';

export const chatKeys = {
  conversations: ['conversations'],
  messages: (connectionId: string) => ['messages', connectionId],
  state: (connectionId: string) => ['chat-state', connectionId],
  modeChange: (connectionId: string) => ['mode-change', connectionId],
  eligibleModes: (otherId: string) => ['eligible-modes', otherId],
  mediaState: (connectionId: string) => ['media-state', connectionId],
  mediaStateIn: (connectionId: string, mode?: string) => [
    'media-state',
    connectionId,
    mode,
  ],
  mediaUrls: (ids: string[]) => ['chat-media-urls', ...ids],
};

// Signed links last 600 s; ask again before they run out.
const mediaUrlRefreshMs = 8 * 60_000;

// One batched call for every media message on screen, expired ones left out.
export function useMediaUrls(messages: Message[]) {
  const ids = messages
    .filter(m => m.media && !m.media.expired)
    .map(m => m.id)
    .sort();
  return useQuery({
    queryKey: chatKeys.mediaUrls(ids),
    queryFn: () => fetchMediaUrls(ids),
    enabled: ids.length > 0,
    staleTime: mediaUrlRefreshMs,
    refetchInterval: mediaUrlRefreshMs,
  });
}

// Keyed by the Mode too: moving into Casual resets both switches, so a Mode Change reloads it.
export function useMediaState(
  connectionId: string,
  mode: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: chatKeys.mediaStateIn(connectionId, mode),
    queryFn: () => fetchMediaState(connectionId),
    enabled,
    // The other side's switch isn't broadcast.
    refetchInterval: 15_000,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: chatKeys.conversations,
    queryFn: fetchConversations,
    // Requests aren't broadcast, so the Inbox badge and lists check now and then.
    refetchInterval: 30_000,
  });
}
