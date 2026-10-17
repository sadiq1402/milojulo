import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { activityKeys } from '../activities/queries';
import { chatKeys } from '../chat/queries';
import { listenToMember } from './memberChannel';

// Mounted only for Members: holds their channel open while signed in and keeps lists current.
export function MemberLive() {
  const client = useQueryClient();
  useEffect(() => {
    let dropped = false;
    return listenToMember({
      onEvent: ({ event, payload }) => {
        const connectionId = String(payload.connection_id);
        const stale = {
          message: [chatKeys.conversations],
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
  return null;
}
