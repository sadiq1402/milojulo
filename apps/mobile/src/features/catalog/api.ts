import { supabase } from '../../lib/supabase';

// Area id → display name ("baner" → "Baner").
export async function fetchAreaNames(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('areas').select('id, name');
  if (error) {
    throw error;
  }
  return Object.fromEntries(data.map(area => [area.id, area.name]));
}
