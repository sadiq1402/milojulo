import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../auth/SessionProvider';
import { fetchAccountStage } from './api';

const key = (userId?: string) => ['account-stage', userId];

export function useAccountStage() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: key(userId),
    queryFn: () => fetchAccountStage(userId!),
    enabled: !!userId,
  });
}

// Call after a step completes; the navigator then shows the next one.
export function useRefreshAccountStage() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['account-stage'] });
}
