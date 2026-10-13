import { useQuery } from '@tanstack/react-query';
import { fetchAreaNames, fetchPromptQuestions, fetchTagNames } from './api';

// Catalogs change only with a migration, so they're loaded once per session.
export const catalogKeys = {
  areas: ['areas'],
  tags: ['tags'],
  promptQuestions: ['prompt-questions'],
};

export function useAreaNames() {
  return useQuery({
    queryKey: catalogKeys.areas,
    queryFn: fetchAreaNames,
    staleTime: Infinity,
  });
}

// Undefined until the catalog loads, or for no Area.
export function useAreaName() {
  const areas = useAreaNames();
  return (areaId: string | null) =>
    (areaId && areas.data?.[areaId]) || undefined;
}

export function useTagNames() {
  return useQuery({
    queryKey: catalogKeys.tags,
    queryFn: fetchTagNames,
    staleTime: Infinity,
  });
}

export function usePromptQuestions() {
  return useQuery({
    queryKey: catalogKeys.promptQuestions,
    queryFn: fetchPromptQuestions,
    staleTime: Infinity,
  });
}
