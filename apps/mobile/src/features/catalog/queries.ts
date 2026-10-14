import { useQuery } from '@tanstack/react-query';
import {
  fetchAreaList,
  fetchAreaNames,
  fetchIndustryList,
  fetchPromptQuestionList,
  fetchPromptQuestions,
  fetchTagList,
  fetchTagNames,
} from './api';

// Catalogs change only with a migration, so they're loaded once per session.
export const catalogKeys = {
  areas: ['areas'],
  tags: ['tags'],
  promptQuestions: ['prompt-questions'],
  areaList: ['area-list'],
  tagList: ['tag-list'],
  promptQuestionList: ['prompt-question-list'],
  industryList: ['industry-list'],
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

export function useAreaList() {
  return useQuery({
    queryKey: catalogKeys.areaList,
    queryFn: fetchAreaList,
    staleTime: Infinity,
  });
}

export function useTagList() {
  return useQuery({
    queryKey: catalogKeys.tagList,
    queryFn: fetchTagList,
    staleTime: Infinity,
  });
}

export function usePromptQuestionList() {
  return useQuery({
    queryKey: catalogKeys.promptQuestionList,
    queryFn: fetchPromptQuestionList,
    staleTime: Infinity,
  });
}

export function useIndustryList() {
  return useQuery({
    queryKey: catalogKeys.industryList,
    queryFn: fetchIndustryList,
    staleTime: Infinity,
  });
}
