import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { fetchConversations, type Message } from './api';
import {
  fetchChatMediaLimits,
  fetchMediaAllowance,
  fetchMediaState,
  fetchMediaUrls,
  fixedLimits,
  type ChatMediaLimits,
} from './media';

export const chatKeys = {
  mediaLimits: ['chat-media-limits'],
  mediaAllowance: (connectionId: string) => [
    'chat-media-allowance',
    connectionId,
  ],
  conversations: ['conversations'],
  messages: (connectionId: string) => ['messages', connectionId],
  // Every chat's state, for invalidating; `state` is one chat's.
  stateAll: ['chat-state'],
  state: (connectionId: string) => ['chat-state', connectionId],
  modeChange: (connectionId: string) => ['mode-change', connectionId],
  eligibleModes: (otherId: string) => ['eligible-modes', otherId],
  // Every Mode's media state for a chat, for invalidating; `mediaState` is one Mode's.
  mediaStateAll: (connectionId: string) => ['media-state', connectionId],
  mediaState: (connectionId: string, mode?: string) => [
    'media-state',
    connectionId,
    mode,
  ],
  // `gate` changes when Media Consent opens or closes, which changes which links are given.
  mediaUrls: (connectionId: string, gate: string) => [
    'chat-media-urls',
    connectionId,
    gate,
  ],
};

// Signed links last 600 s; ask again before they run out.
const mediaUrlRefreshMs = 8 * 60_000;

// Links for every media message on screen, expired ones left out: one batched call when the chat
// opens (and every refresh), then only the ids that arrive later.
export function useMediaUrls(
  connectionId: string,
  messages: Message[],
  gate: string,
  enabled: boolean,
) {
  const client = useQueryClient();
  const ids = messages
    .filter(m => m.media && !m.media.expired)
    .map(m => m.id)
    .sort();
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const asked = useRef(new Set<string>());
  const [, setFailed] = useState(0);
  const key = chatKeys.mediaUrls(connectionId, gate);
  const query = useQuery({
    queryKey: key,
    queryFn: () => {
      const all = idsRef.current;
      all.forEach(id => asked.current.add(id));
      return fetchMediaUrls(all);
    },
    enabled: enabled && ids.length > 0,
    staleTime: mediaUrlRefreshMs,
    refetchInterval: mediaUrlRefreshMs,
  });

  const fresh = query.isSuccess ? ids.filter(id => !asked.current.has(id)) : [];
  const freshKey = fresh.join();
  useEffect(() => {
    if (!freshKey) {
      return;
    }
    const batch = freshKey.split(',');
    batch.forEach(id => asked.current.add(id));
    fetchMediaUrls(batch)
      .then(urls =>
        client.setQueryData<Record<string, string>>(
          chatKeys.mediaUrls(connectionId, gate),
          old => ({
            ...old,
            ...urls,
          }),
        ),
      )
      .catch(() => {
        batch.forEach(id => asked.current.delete(id));
        setFailed(n => n + 1);
      });
  }, [freshKey, client, connectionId, gate]);

  const urls = query.data ?? {};
  return {
    urls,
    // Still waiting for this id's link, rather than refused one.
    loading: (id: string) =>
      !(id in urls) && (query.isPending || fresh.includes(id)),
  };
}

// Keyed by the Mode too: moving into Casual resets both switches, so a Mode Change reloads it.
export function useMediaState(
  connectionId: string,
  mode: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: chatKeys.mediaState(connectionId, mode),
    queryFn: () => fetchMediaState(connectionId),
    enabled,
  });
}

// The server's chat media limits (#182); the fixed maximums until they arrive.
export function useChatMediaLimits(): ChatMediaLimits {
  const query = useQuery({
    queryKey: chatKeys.mediaLimits,
    queryFn: fetchChatMediaLimits,
  });
  return query.data ?? fixedLimits;
}

// The caller's media allowance in one chat (#183), read on every open and return to the app.
export function useMediaAllowance(connectionId: string, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.mediaAllowance(connectionId),
    queryFn: () => fetchMediaAllowance(connectionId),
    enabled,
    staleTime: 0,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: chatKeys.conversations,
    queryFn: fetchConversations,
  });
}
