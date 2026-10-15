import { supabase } from '../../lib/supabase';

export type BlockedMember = { memberId: string; name: string; blockedAt: string };

export const couldNotLoad =
  "We couldn't load this. Check your connection and try again.";
const fallback = "That didn't work. Check your connection and try again.";

// The address safety reports and questions go to; confirm with the founder before launch.
export const supportEmail = 'support@milojulo.in';

// Pausing hides me from new people only; existing chats carry on.
export async function setPaused(paused: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_paused', { paused });
  if (error) {
    throw new Error(fallback);
  }
}

export async function fetchMyBlocks(): Promise<BlockedMember[]> {
  const { data, error } = await supabase.rpc('my_blocks');
  if (error) {
    throw new Error(couldNotLoad);
  }
  return data.map(row => ({
    memberId: row.member_id,
    name: row.display_name,
    blockedAt: row.blocked_at,
  }));
}

// RLS lets a Member delete only the Blocks they made, so this never touches the other way round.
export async function unblock(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocked_id', memberId);
  if (error) {
    throw new Error(fallback);
  }
}

// Whole years, in India time's calendar day being close enough to UTC's for a birthday.
export function ageOn(birthDate: string, today: Date): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  const age = today.getUTCFullYear() - y;
  const month = today.getUTCMonth() + 1;
  const hadBirthday =
    month > m || (month === m && today.getUTCDate() >= d);
  return hadBirthday ? age : age - 1;
}
