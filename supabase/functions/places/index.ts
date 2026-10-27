// Place search (#248): Google Places API (New) autocomplete and details for an Activity's venue. The
// rules live in handler.ts; this file only wires in Supabase, the key and fetch.
import { createClient } from '@supabase/supabase-js';
import { createHandler } from './handler.ts';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`places: ${name} is not set`);
  return value;
}

const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const handler = createHandler({
  async userIdFor(token) {
    const { data, error } = await supabase.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  async searchBias(memberId) {
    const { data, error } = await supabase.rpc('place_search_bias', { member_id: memberId });
    if (error) throw new Error(`place_search_bias: ${error.message}`);
    const row = (data as { lat: number; lng: number }[] | null)?.[0];
    return row ? { lat: row.lat, lng: row.lng } : null;
  },
  apiKey: env('GOOGLE_PLACES_KEY'),
  fetch: (input, init) => fetch(input, init),
});

Deno.serve(handler);
