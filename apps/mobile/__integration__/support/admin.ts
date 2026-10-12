import { createClient } from '@supabase/supabase-js';

// Service-role client for test setup only (what an admin or the dashboard would do); never used by the app.
const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
  },
);

export async function createInvite(
  code: string,
  {
    usesLeft = 5,
    expiresAt = null,
  }: { usesLeft?: number; expiresAt?: string | null } = {},
) {
  const { error } = await admin
    .from('invite_codes')
    .insert({ code, uses_left: usesLeft, expires_at: expiresAt });
  if (error) {
    throw error;
  }
}
