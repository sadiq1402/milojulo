import { supabase } from '../../lib/supabase';

// Callable before sign-in; says only whether the code can still be redeemed.
export async function checkInvite(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_invite', {
    invite_code: code.trim(),
  });
  if (error) {
    throw error;
  }
  return data;
}

export const invalidInviteMessage =
  "This invite code doesn't work. It may be mistyped, used up or expired.";

// Redeems the checked code for the signed-in account; a repeat after a retry is a no-op.
export async function redeemInvite(code: string): Promise<void> {
  const { error } = await supabase.rpc('redeem_invite', {
    invite_code: code.trim(),
  });
  if (!error || error.message === 'invite already redeemed') {
    return;
  }
  throw new Error(
    error.message === 'invite code is not valid'
      ? invalidInviteMessage
      : error.message,
  );
}
