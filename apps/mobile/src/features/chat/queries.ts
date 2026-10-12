import { useQuery } from '@tanstack/react-query';
import { fetchConversations } from './api';

export const chatKeys = {
  conversations: ['conversations'],
  messages: (connectionId: string) => ['messages', connectionId],
  state: (connectionId: string) => ['chat-state', connectionId],
  modeChange: (connectionId: string) => ['mode-change', connectionId],
  eligibleModes: (otherId: string) => ['eligible-modes', otherId],
};

export function useConversations() {
  return useQuery({
    queryKey: chatKeys.conversations,
    queryFn: fetchConversations,
    // Requests aren't broadcast, so the Inbox badge and lists check now and then.
    refetchInterval: 30_000,
  });
}
