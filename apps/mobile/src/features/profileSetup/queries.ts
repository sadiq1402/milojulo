import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDraft } from './api';
import type { ProfileDraft } from './model';

const draftKey = (userId: string) => ['profile-draft', userId];

export function useProfileDraft(userId: string) {
  return useQuery({
    queryKey: draftKey(userId),
    queryFn: () => fetchDraft(userId),
  });
}

// After a step saves, keep what it saved so going back shows it without a refetch.
export function useUpdateDraft(userId: string) {
  const client = useQueryClient();
  return (changes: Partial<ProfileDraft>) =>
    client.setQueryData<ProfileDraft>(draftKey(userId), draft =>
      draft ? { ...draft, ...changes } : draft,
    );
}
