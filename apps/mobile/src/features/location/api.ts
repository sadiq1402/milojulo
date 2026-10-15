import { supabase } from '../../lib/supabase';

// Refusals the app passes over quietly: the next app open tries again, and outside Pune the
// feed measures from the Member's Area centre.
const quiet = [
  'you can update your location once an hour',
  'that location is outside Pune',
];

export async function setLocation(lat: number, lng: number): Promise<void> {
  const { error } = await supabase.rpc('set_location', { lat, lng });
  if (error && !quiet.includes(error.message)) {
    throw new Error(error.message);
  }
}
