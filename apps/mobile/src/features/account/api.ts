import { supabase } from '../../lib/supabase';

// The step a signed-in account is at: give age and consents, build a profile, or a Member.
export type AccountStage = 'consent' | 'profile' | 'member';

export async function fetchAccountStage(userId: string): Promise<AccountStage> {
  const { data, error } = await supabase
    .from('profiles')
    .select('date_of_birth, submitted_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  // accept_consents creates the profile row, so a new account has none yet.
  if (!data?.date_of_birth) {
    return 'consent';
  }
  return data.submitted_at ? 'member' : 'profile';
}
