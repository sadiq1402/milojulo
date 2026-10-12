import type { AuthError, Session } from '@supabase/supabase-js';
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

const friendly: Record<string, string> = {
  otp_expired:
    'That code is wrong or has expired. Check it, or send a new one.',
  email_address_invalid: 'Enter a valid email address.',
  validation_failed: 'Enter a valid email address.',
  over_email_send_rate_limit:
    'Too many codes sent. Wait a minute, then try again.',
  over_request_rate_limit: 'Too many tries. Wait a minute, then try again.',
};

function friendlyAuthError(error: AuthError): Error {
  return new Error((error.code && friendly[error.code]) || error.message);
}

// Email OTP: a 6-digit code, never a magic link.
export async function sendCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    throw friendlyAuthError(error);
  }
}

export async function verifyCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  });
  if (error) {
    throw friendlyAuthError(error);
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}
