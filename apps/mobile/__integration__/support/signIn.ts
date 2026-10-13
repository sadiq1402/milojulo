import { sendCode, signOut, verifyCode } from '../../src/features/auth/api';
import { supabase } from '../../src/lib/supabase';
import { latestCodeFor } from './mailpit';

let counter = 0;

// Signs a brand-new account in through the real email-code flow; returns its user id.
export async function signInNewAccount(): Promise<string> {
  await signOut();
  const email = `member-${Date.now()}-${counter++}@test.milojulo`;
  await sendCode(email);
  await verifyCode(email, await latestCodeFor(email));
  const { data } = await supabase.auth.getUser();
  return data.user!.id;
}
