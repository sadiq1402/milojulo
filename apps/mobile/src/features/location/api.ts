import { supabase } from '../../lib/supabase';

// set_location and needs_reconsent arrive with #102; once it merges, regenerate
// database.types and call supabase.rpc directly.
export const pendingRpc = (fn: string, args?: Record<string, unknown>) =>
  (
    supabase as unknown as {
      rpc: (
        name: string,
        params?: Record<string, unknown>,
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc(fn, args);

export async function setLocation(lat: number, lng: number): Promise<void> {
  const { error } = await pendingRpc('set_location', { lat, lng });
  if (error) {
    throw new Error(error.message);
  }
}
