import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';
import { navigationRef } from '../../navigation/navigationRef';
import { activityKeys } from '../activities/queries';
import type { Conversation } from '../chat/api';
import { chatKeys } from '../chat/queries';
import { LiveBanner, looksAtChat, type Banner } from './LiveBanner';
import { listenToMember, type MemberEvent } from './memberChannel';

// What a message says on the banner. Media has no body to show.
const lineFor = (payload: MemberEvent['payload']) =>
  payload.type === 'text' && typeof payload.body === 'string'
    ? payload.body
    : 'Sent you something';

// Mounted only for Members: holds their channel open while signed in and keeps lists current.
export function MemberLive() {
  const client = useQueryClient();
  const [banner, setBanner] = useState<Banner>();
  const dismiss = useCallback(() => setBanner(undefined), []);

  useEffect(() => {
    let dropped = false;
    return listenToMember({
      onEvent: ({ event, payload }) => {
        const connectionId = String(payload.connection_id);
        const stale = {
          message: [chatKeys.conversations],
          'message-removed': [chatKeys.conversations],
          connection: [chatKeys.conversations],
          'join-request': [activityKeys.all],
          read: [chatKeys.state(connectionId)],
          'media-consent': [chatKeys.mediaStateAll(connectionId)],
          'mode-change': [
            chatKeys.modeChange(connectionId),
            chatKeys.conversations,
          ],
        }[event];
        stale?.forEach(queryKey => client.invalidateQueries({ queryKey }));

        // Say what arrived, unless it is the chat already on screen (#202). The name comes from
        // the conversations already on the phone; a request may not be there yet, so it is told
        // plainly instead of waiting for a refetch.
        const named = (
          client.getQueryData(chatKeys.conversations) as
            | Conversation[]
            | undefined
        )?.find(c => c.connectionId === connectionId);
        if (event === 'message' && !looksAtChat(connectionId)) {
          setBanner({
            name: named?.otherName ?? 'New message',
            line: lineFor(payload),
            open: () =>
              navigationRef.isReady() &&
              navigationRef.navigate('Chat', { connectionId }),
          });
        } else if (event === 'connection' && named?.status === 'requested') {
          setBanner({
            name: named.otherName,
            line: 'Wants to connect',
            open: () =>
              navigationRef.isReady() &&
              navigationRef.navigate('Tabs', {
                screen: 'Inbox',
                params: { segment: 'requests' },
              }),
          });
        }
      },
      // Back after a drop: anything on screen may have missed events.
      onStatus: status => {
        if (status === 'offline') {
          dropped = true;
        } else if (dropped) {
          dropped = false;
          client.invalidateQueries();
        }
      },
    });
  }, [client]);
  return <LiveBanner banner={banner} onDismiss={dismiss} />;
}
