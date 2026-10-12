import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  fetchChatState,
  fetchMessages,
  markRead,
  newMessageId,
  sendMessage,
  subscribeToChat,
  type Message,
} from './api';
import { catchUpFrom, mergeMessages } from './messages';

export type ChatItem = Message & { delivery: 'sent' | 'sending' | 'failed' };
type Pending = {
  id: string;
  body: string;
  createdAt: string;
  delivery: 'sending' | 'failed';
};

export const conversationsKey = ['conversations'];

// One chat: messages from the first load, the live channel and catch-ups, plus sends that
// are still on their way.
export function useChat(connectionId: string, myId: string) {
  const client = useQueryClient();
  const key = useMemo(() => ['messages', connectionId], [connectionId]);
  const messages = useQuery({
    queryKey: key,
    queryFn: () => fetchMessages(connectionId),
  });
  const state = useQuery({
    queryKey: ['chat-state', connectionId],
    queryFn: () => fetchChatState(connectionId),
    // The other side's read position isn't broadcast, so check it now and then.
    refetchInterval: 15_000,
  });
  const [pending, setPending] = useState<Pending[]>([]);

  const merge = useCallback(
    (incoming: Message[]) =>
      client.setQueryData<Message[]>(key, current =>
        mergeMessages(current ?? [], incoming),
      ),
    [client, key],
  );
  const catchUp = useCallback(async () => {
    const seen = client.getQueryData<Message[]>(key) ?? [];
    merge(await fetchMessages(connectionId, catchUpFrom(seen)));
  }, [client, key, merge, connectionId]);

  useEffect(
    () =>
      subscribeToChat(connectionId, {
        onMessage: message => merge([message]),
        onStatus: status => {
          if (status === 'live') {
            catchUp().catch(() => {});
          }
        },
      }),
    [connectionId, merge, catchUp],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', appState => {
      if (appState === 'active') {
        catchUp().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [catchUp]);

  // Everything up to the newest message on screen counts as read.
  const newestAt = messages.data?.at(-1)?.createdAt;
  const markedAt = useRef<string>(undefined);
  useEffect(() => {
    if (newestAt && newestAt !== markedAt.current) {
      markedAt.current = newestAt;
      markRead(connectionId, newestAt)
        .then(() => client.invalidateQueries({ queryKey: conversationsKey }))
        .catch(() => {});
    }
  }, [newestAt, connectionId, client]);

  const attempt = useCallback(
    async (id: string, body: string) => {
      setPending(list =>
        list.map(p => (p.id === id ? { ...p, delivery: 'sending' } : p)),
      );
      try {
        await sendMessage({ id, connectionId, body });
        await catchUp().catch(() => {});
      } catch {
        setPending(list =>
          list.map(p => (p.id === id ? { ...p, delivery: 'failed' } : p)),
        );
      }
    },
    [connectionId, catchUp],
  );

  const send = (body: string) => {
    const id = newMessageId();
    setPending(list => [
      ...list,
      { id, body, createdAt: new Date().toISOString(), delivery: 'sending' },
    ]);
    attempt(id, body);
  };
  const retry = (id: string) => {
    const message = pending.find(p => p.id === id);
    if (message) {
      attempt(id, message.body);
    }
  };

  const confirmed = messages.data ?? [];
  const confirmedIds = new Set(confirmed.map(m => m.id));
  const items: ChatItem[] = [
    ...confirmed.map(m => ({ ...m, delivery: 'sent' as const })),
    ...pending
      .filter(p => !confirmedIds.has(p.id))
      .map(p => ({
        id: p.id,
        connectionId,
        senderId: myId,
        type: 'text' as const,
        body: p.body,
        activityId: null,
        createdAt: p.createdAt,
        delivery: p.delivery,
      })),
  ];

  return {
    items,
    loading: messages.isPending,
    otherLastReadAt: state.data?.otherLastReadAt ?? null,
    muted: state.data?.muted ?? false,
    send,
    retry,
  };
}
