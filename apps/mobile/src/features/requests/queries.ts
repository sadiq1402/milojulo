import { useMyJoinRequests } from '../activities/queries';
import { useConversations } from '../chat/queries';

// Connection Requests are the caller's Connections still in the Requested state; Join Requests
// come from their own list, pending ones only.
export function useRequests() {
  const conversations = useConversations();
  const joinRequests = useMyJoinRequests();
  const requested = (conversations.data ?? []).filter(
    c => c.status === 'requested',
  );
  const joins = joinRequests.data ?? [];
  return {
    conversations,
    joinRequests,
    waiting: requested.filter(c => c.direction === 'incoming'),
    sent: requested.filter(c => c.direction === 'outgoing'),
    joinWaiting: joins.filter(r => r.direction === 'incoming'),
    joinSent: joins.filter(r => r.direction === 'outgoing'),
  };
}
