import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { chatKeys } from '../chat/queries';
import { listenToMember } from './memberChannel';

// Mounted only for Members: holds their channel open while signed in and keeps lists current.
export function MemberLive() {
  const client = useQueryClient();
  useEffect(() => {
    let dropped = false;
    return listenToMember({
      onEvent: ({ event }) => {
        if (event === 'message') {
          client.invalidateQueries({ queryKey: chatKeys.conversations });
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
  return null;
}
