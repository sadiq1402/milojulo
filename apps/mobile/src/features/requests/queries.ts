import { useMyJoinRequests } from '../activities/queries';
import { useConversations } from '../chat/queries';

// Connection Requests come from the chat list, Join Requests from their own.
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
    // Chats with something unread. The Inbox badge counts these alongside waiting requests,
    // so a message you haven't read shows on the tab (#202).
    unreadChats: (conversations.data ?? []).filter(
      c => c.status === 'accepted' && c.unreadCount > 0,
    ),
  };
}
