import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Mode } from '../modes';
import {
  fetchOpenModeChange,
  proposeModeChange,
  respondModeChange,
} from './modeChange';
import { chatKeys } from './queries';

// The chat's open Mode Change proposal, and proposing or answering one.
export function useModeChange(connectionId: string) {
  const client = useQueryClient();
  const open = useQuery({
    queryKey: chatKeys.modeChange(connectionId),
    queryFn: () => fetchOpenModeChange(connectionId),
    // Proposals aren't broadcast, so check now and then while the chat is open.
    refetchInterval: 15_000,
  });
  const refresh = () => {
    client.invalidateQueries({ queryKey: chatKeys.modeChange(connectionId) });
    client.invalidateQueries({ queryKey: chatKeys.conversations });
  };
  const propose = useMutation({
    mutationFn: (mode: Mode) => proposeModeChange(connectionId, mode),
    onSuccess: refresh,
  });
  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      respondModeChange(id, accept),
    onSuccess: refresh,
  });
  return { open: open.data ?? null, propose, respond };
}
