import { supabase } from '../../lib/supabase';
import { signOut } from '../auth/api';
import { clearPendingInvite } from '../invite/pendingCode';

// The step a signed-in account is at: redeem an invite, give age and consents, build a profile, or a Member.
export type AccountStage = 'invite' | 'consent' | 'profile' | 'member';

export async function fetchAccountStage(userId: string): Promise<AccountStage> {
  const { data, error } = await supabase
    .from('profiles')
    .select('date_of_birth, submitted_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return 'invite';
  }
  if (!data.date_of_birth) {
    return 'consent';
  }
  return data.submitted_at ? 'member' : 'profile';
}

// Signing out also forgets an invite code that was checked but never redeemed.
export async function signOutCompletely(): Promise<void> {
  await clearPendingInvite();
  await signOut();
}
