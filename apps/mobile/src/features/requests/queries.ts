import { useConversations } from '../chat/queries';

// Connection Requests are the caller's Connections still in the Requested state.
export function useRequests() {
  const conversations = useConversations();
  const requested = (conversations.data ?? []).filter(
    c => c.status === 'requested',
  );
  return {
    conversations,
    waiting: requested.filter(c => c.direction === 'incoming'),
    sent: requested.filter(c => c.direction === 'outgoing'),
  };
}
