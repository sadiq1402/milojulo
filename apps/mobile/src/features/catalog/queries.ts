import { useQuery } from '@tanstack/react-query';
import { fetchAreaNames } from './api';

// Catalogs change only with a migration, so they're loaded once per session.
export const catalogKeys = { areas: ['areas'] };

export function useAreaNames() {
  return useQuery({
    queryKey: catalogKeys.areas,
    queryFn: fetchAreaNames,
    staleTime: Infinity,
  });
}
