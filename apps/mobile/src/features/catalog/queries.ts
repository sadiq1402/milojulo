import { useQuery } from '@tanstack/react-query';
import {
  fetchAreas,
  fetchIndustries,
  fetchPromptQuestions,
  fetchTags,
  type CatalogItem,
} from './api';

// Catalogs change only with a migration, so they're loaded once per session. Each is cached
// once and read either as an id → label lookup or as the active entries in order.
export const catalogKeys = {
  areas: ['areas'],
  tags: ['tags'],
  promptQuestions: ['prompt-questions'],
  industries: ['industries'],
};

const toNames = <Id extends string | number>(items: CatalogItem<Id>[]) =>
  Object.fromEntries(items.map(item => [item.id, item.label])) as Record<
    Id,
    string
  >;
const activeOnly = <Item extends { active: boolean }>(items: Item[]) =>
  items.filter(item => item.active);

export function useAreaNames() {
  return useQuery({
    queryKey: catalogKeys.areas,
    queryFn: fetchAreas,
    staleTime: Infinity,
    select: toNames,
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
    queryFn: fetchTags,
    staleTime: Infinity,
    select: toNames,
  });
}

export function usePromptQuestions() {
  return useQuery({
    queryKey: catalogKeys.promptQuestions,
    queryFn: fetchPromptQuestions,
    staleTime: Infinity,
    select: toNames,
  });
}

export function useAreaList() {
  return useQuery({
    queryKey: catalogKeys.areas,
    queryFn: fetchAreas,
    staleTime: Infinity,
    select: activeOnly,
  });
}

export function useTagList() {
  return useQuery({
    queryKey: catalogKeys.tags,
    queryFn: fetchTags,
    staleTime: Infinity,
    select: activeOnly,
  });
}

export function usePromptQuestionList() {
  return useQuery({
    queryKey: catalogKeys.promptQuestions,
    queryFn: fetchPromptQuestions,
    staleTime: Infinity,
    select: activeOnly,
  });
}

export function useIndustryList() {
  return useQuery({
    queryKey: catalogKeys.industries,
    queryFn: fetchIndustries,
    staleTime: Infinity,
    select: activeOnly,
  });
}
