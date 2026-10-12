import { supabase } from '../../lib/supabase';
import type { Mode } from '../modes';

export type ModeChange = {
  id: string;
  proposedBy: string | null;
  fromMode: Mode;
  toMode: Mode;
  proposedAt: string;
};

// An open proposal older than this has lapsed (database rule, #11).
const lapseAfterMs = 7 * 86_400_000;

// Modes both Members hold that also pass both sides' Dating Preferences.
export async function fetchEligibleModes(otherId: string): Promise<Mode[]> {
  const { data, error } = await supabase.rpc('get_profile', {
    member_id: otherId,
  });
  if (error) {
    throw error;
  }
  return data[0]?.modes ?? [];
}

// The proposal waiting for an answer, if any; a lapsed one counts as none.
export async function fetchOpenModeChange(
  connectionId: string,
): Promise<ModeChange | null> {
  const { data, error } = await supabase
    .from('connection_mode_changes')
    .select('id, proposed_by, from_mode, to_mode, proposed_at')
    .eq('connection_id', connectionId)
    .is('outcome', null)
    .gt('proposed_at', new Date(Date.now() - lapseAfterMs).toISOString())
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data
    ? {
        id: data.id,
        proposedBy: data.proposed_by,
        fromMode: data.from_mode,
        toMode: data.to_mode,
        proposedAt: data.proposed_at,
      }
    : null;
}

const friendly: Record<string, string> = {
  'there is already an open mode change':
    "There's already a Mode change waiting for an answer.",
  'your last mode change was declined recently':
    'Your last Mode change was declined. You can suggest another in 7 days.',
  'that mode is not open between you': "That Mode isn't open between you two.",
  'the connection is already in that mode':
    'This chat is already in that Mode.',
  'no connection to change': "This chat is closed, so its Mode can't change.",
  'no mode change to answer':
    'This Mode change is no longer waiting for an answer.',
  'that mode is no longer open between you':
    "That Mode isn't open between you two any more, so it can't be accepted. You can decline it.",
};

export async function proposeModeChange(
  connectionId: string,
  toMode: Mode,
): Promise<void> {
  const { error } = await supabase.rpc('propose_mode_change', {
    connection_id: connectionId,
    to_mode: toMode,
  });
  if (error) {
    throw new Error(friendly[error.message] ?? error.message);
  }
}

export async function respondModeChange(
  changeId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('respond_mode_change', {
    change_id: changeId,
    accept,
  });
  if (error) {
    throw new Error(friendly[error.message] ?? error.message);
  }
}
