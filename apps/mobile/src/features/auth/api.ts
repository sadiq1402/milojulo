import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

// Called at once with the current session (INITIAL_SESSION), then on every change.
export function onSessionChange(
  listener: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    listener(session),
  );
  return () => data.subscription.unsubscribe();
}

// Email OTP: a 6-digit code, never a magic link.
export async function sendCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    throw error;
  }
}

export async function verifyCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  });
  if (error) {
    throw error;
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}
