import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  cannotSendMessage,
  fetchChatState,
  fetchMessages,
  markRead,
  newMessageId,
  sendMessage,
  subscribeToChat,
  type Message,
} from './api';
import { catchUpFrom, mergeMessages } from './messages';
import { chatKeys } from './queries';

// 'refused': the Connection closed or a Block landed, so retrying can't help.
type Delivery = 'sent' | 'sending' | 'failed' | 'refused';
export type ChatItem = Message & { delivery: Delivery };
type Pending = {
  id: string;
  body: string;
  createdAt: string;
  delivery: Delivery;
};

// One chat: messages from the first load, the live channel and catch-ups, plus sends still on
// their way. `reading` is whether the Member can see the chat right now.
export function useChat(connectionId: string, myId: string, reading: boolean) {
  const client = useQueryClient();
  const key = chatKeys.messages(connectionId);
  const messages = useQuery({
    queryKey: key,
    queryFn: () => fetchMessages(connectionId),
  });
  const state = useQuery({
    queryKey: chatKeys.state(connectionId),
    queryFn: () => fetchChatState(connectionId),
    // The other side's read position isn't broadcast, so check it now and then.
    refetchInterval: 15_000,
  });
  const [pending, setPending] = useState<Pending[]>([]);
  const setDelivery = (id: string, delivery: Delivery) =>
    setPending(list => list.map(p => (p.id === id ? { ...p, delivery } : p)));

  const merge = useCallback(
    (incoming: Message[]) =>
      client.setQueryData<Message[]>(chatKeys.messages(connectionId), current =>
        mergeMessages(current ?? [], incoming),
      ),
    [client, connectionId],
  );
  const catchUp = useCallback(async () => {
    const seen =
      client.getQueryData<Message[]>(chatKeys.messages(connectionId)) ?? [];
    merge(await fetchMessages(connectionId, catchUpFrom(seen)));
  }, [client, merge, connectionId]);

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

  const [appActive, setAppActive] = useState(
    AppState.currentState !== 'background',
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', appState => {
      setAppActive(appState === 'active');
      if (appState === 'active') {
        catchUp().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [catchUp]);

  // Everything up to the newest message on screen counts as read, but only while it's seen.
  const newestAt = messages.data?.at(-1)?.createdAt;
  const markedAt = useRef<string>(undefined);
  useEffect(() => {
    if (reading && appActive && newestAt && newestAt !== markedAt.current) {
      markedAt.current = newestAt;
      markRead(connectionId, newestAt)
        .then(() =>
          client.invalidateQueries({ queryKey: chatKeys.conversations }),
        )
        .catch(() => {});
    }
  }, [reading, appActive, newestAt, connectionId, client]);

  const attempt = async (id: string, body: string) => {
    setDelivery(id, 'sending');
    try {
      await sendMessage({ id, connectionId, body });
    } catch (e) {
      setDelivery(
        id,
        (e as Error).message === cannotSendMessage ? 'refused' : 'failed',
      );
      return;
    }
    setDelivery(id, 'sent');
    catchUp().catch(() => {});
  };

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

  // "Seen" goes under my newest delivered message once the other side has read up to it.
  const otherLastReadAt = state.data?.otherLastReadAt;
  const myNewest = [...confirmed].reverse().find(m => m.senderId === myId);
  const seenId =
    myNewest && otherLastReadAt && otherLastReadAt >= myNewest.createdAt
      ? myNewest.id
      : undefined;

  return {
    items,
    loading: messages.isPending,
    seenId,
    muted: state.data?.muted ?? false,
    send,
    retry,
  };
}
