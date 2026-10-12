import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { Mode } from '../modes';
import {
  fetchEligibleModes,
  fetchOpenModeChange,
  proposeModeChange,
  respondModeChange,
} from './api';
import { chatKeys } from './queries';

// The chat's open Mode Change proposal, the Modes it could move to, and proposing or answering.
// `choosing` loads the Eligible Modes only while the Member is picking one.
export function useModeChange(
  connectionId: string,
  otherId: string | undefined,
  choosing: boolean,
) {
  const client = useQueryClient();
  const open = useQuery({
    queryKey: chatKeys.modeChange(connectionId),
    queryFn: () => fetchOpenModeChange(connectionId),
    // Proposals aren't broadcast, so check now and then while the chat is open.
    refetchInterval: 15_000,
  });
  const eligible = useQuery({
    queryKey: chatKeys.eligibleModes(otherId ?? ''),
    queryFn: () => fetchEligibleModes(otherId!),
    enabled: choosing && !!otherId,
  });

  const refreshConversation = () =>
    client.invalidateQueries({ queryKey: chatKeys.conversations });
  // When a proposal stops being open (accepted, declined or lapsed, possibly on the other
  // phone), the Connection's Mode may have changed.
  const openId = open.data?.id;
  const previousOpenId = useRef(openId);
  useEffect(() => {
    if (previousOpenId.current && previousOpenId.current !== openId) {
      client.invalidateQueries({ queryKey: chatKeys.conversations });
    }
    previousOpenId.current = openId;
  }, [openId, client]);

  const refresh = () => {
    client.invalidateQueries({ queryKey: chatKeys.modeChange(connectionId) });
    refreshConversation();
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
  return {
    open: open.data ?? null,
    eligibleModes: eligible.data,
    propose,
    respond,
  };
}
