import { supabase } from '../../lib/supabase';

// Passed over quietly: the point sent within the hour stands, and the next app open tries again.
const quiet = ['you can update your location once an hour'];

export async function setLocation(lat: number, lng: number): Promise<void> {
  const { error } = await supabase.rpc('set_location', { lat, lng });
  if (error && !quiet.includes(error.message)) {
    throw new Error(error.message);
  }
}
