import { supabase } from '../../lib/supabase';

// Where a signed-in account belongs: still onboarding, or a Member with a Submitted Profile.
export type AccountStage = 'onboarding' | 'member';

export async function fetchAccountStage(userId: string): Promise<AccountStage> {
  const { data, error } = await supabase
    .from('profiles')
    .select('submitted_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data?.submitted_at ? 'member' : 'onboarding';
}
