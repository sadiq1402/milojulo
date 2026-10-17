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
import {
  insertMediaMessage,
  uploadChatMedia,
  type OutgoingMedia,
} from './media';
import { catchUpFrom, mergeMessages, toMessageMedia } from './messages';
import { chatKeys } from './queries';

// 'refused': the Connection closed or a Block landed, so retrying can't help.
type Delivery = 'sent' | 'sending' | 'failed' | 'refused';
// A media send still on its way shows the file from the phone (`localUri`); `failure` says why
// one didn't go (too large, media off, ...).
export type ChatItem = Message & {
  delivery: Delivery;
  localUri?: string;
  failure?: string;
};
type Pending = {
  id: string;
  body: string | null;
  media: OutgoingMedia | null;
  createdAt: string;
  delivery: Delivery;
  failure?: string;
  // Set once the upload is confirmed, so a retry only sends the message.
  mediaKey?: string;
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
  });
  const [pending, setPending] = useState<Pending[]>([]);
  const setDelivery = (id: string, delivery: Delivery, failure?: string) =>
    setPending(list =>
      list.map(p => (p.id === id ? { ...p, delivery, failure } : p)),
    );

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

  // A retry reuses the id, so a send that got through earlier isn't doubled.
  const attempt = async (message: Pending) => {
    const { id, body, media } = message;
    setDelivery(id, 'sending');
    try {
      if (media) {
        let mediaKey = message.mediaKey;
        if (!mediaKey) {
          mediaKey = await uploadChatMedia(connectionId, media);
          const uploaded = mediaKey;
          setPending(list =>
            list.map(p => (p.id === id ? { ...p, mediaKey: uploaded } : p)),
          );
        }
        await insertMediaMessage({ id, connectionId, media, mediaKey });
      } else {
        await sendMessage({ id, connectionId, body: body ?? '' });
      }
    } catch (e) {
      const reason = (e as Error).message;
      if (reason === cannotSendMessage) {
        setDelivery(id, 'refused');
      } else {
        setDelivery(id, 'failed', media ? reason : undefined);
      }
      return;
    }
    setDelivery(id, 'sent');
    catchUp().catch(() => {});
  };

  const queue = (body: string | null, media: OutgoingMedia | null) => {
    const message: Pending = {
      id: newMessageId(),
      body,
      media,
      createdAt: new Date().toISOString(),
      delivery: 'sending',
    };
    setPending(list => [...list, message]);
    attempt(message);
  };
  const send = (body: string) => queue(body, null);
  const sendMedia = (media: OutgoingMedia) => queue(null, media);
  const retry = (id: string) => {
    const message = pending.find(p => p.id === id);
    if (message) {
      attempt(message);
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
        type: p.media?.kind ?? ('text' as const),
        body: p.body,
        activityId: null,
        createdAt: p.createdAt,
        media: p.media
          ? toMessageMedia(p.media.kind, {
              media_mime: p.media.mime,
              media_width: p.media.width,
              media_height: p.media.height,
              media_duration_ms: p.media.durationMs,
              media_deleted_at: null,
            })
          : null,
        delivery: p.delivery,
        localUri: p.media?.uri,
        failure: p.failure,
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
    sendMedia,
    retry,
  };
}
