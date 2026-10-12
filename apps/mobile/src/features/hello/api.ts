import { supabase } from '../../lib/supabase';

// Smoke test of the signed-in path: the JWT reaches Postgres and a function answers under RLS.
export async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) {
    throw error;
  }
  return data;
}
