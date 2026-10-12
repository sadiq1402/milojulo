import { useQuery } from '@tanstack/react-query';
import { fetchConversations } from './api';

export const chatKeys = {
  conversations: ['conversations'],
  messages: (connectionId: string) => ['messages', connectionId],
  state: (connectionId: string) => ['chat-state', connectionId],
  modeChange: (connectionId: string) => ['mode-change', connectionId],
};

export function useConversations() {
  return useQuery({
    queryKey: chatKeys.conversations,
    queryFn: fetchConversations,
  });
}
