import { QueryClient } from '@tanstack/react-query';
import { cacheMaxAge } from './persistCache';

export const queryClient = new QueryClient({
  // Kept in memory as long as on the phone (persistCache), so saved lists aren't dropped early.
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000, gcTime: cacheMaxAge },
  },
});
