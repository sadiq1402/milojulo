import { supabase } from '../../lib/supabase';
import type { Mode } from '../modes';

export const noteMaxLength = 200;

// "you cannot send a request to this Member" covers a Block as well as a hidden Member, so its
// copy says only that they aren't available.
const friendly: Record<string, string> = {
  'unpause your profile to send requests':
    'Your profile is paused. Unpause it to send requests.',
  'your profile is not visible':
    "Your profile isn't visible right now, so you can't send requests.",
  'you cannot send a request to this member':
    "This Member isn't available for requests right now.",
  'that mode is not open between you': "That Mode isn't open between you two.",
  'you already have a connection or request with this member':
    "You're already connected with this Member, or a request between you is waiting.",
  'this member declined your request recently':
    "You can't send this Member another request yet.",
  'you have sent 10 requests in the last 24 hours':
    "You've sent 10 requests in the last 24 hours, the most allowed. Try again later.",
  'no request to answer': 'This request is no longer waiting for an answer.',
};

// Anything unexpected (usually no connection) gets one plain message.
const fallback = "That didn't work. Check your connection and try again.";

export async function sendRequest(
  toMemberId: string,
  mode: Mode,
  note?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('send_request', {
    to_member: toMemberId,
    mode,
    note: note?.trim() || undefined,
  });
  if (error) {
    throw new Error(friendly[error.message] ?? fallback);
  }
  return data;
}

// Declining tells the sender nothing; the request just leaves both lists.
export async function respondRequest(
  connectionId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('respond_request', {
    connection_id: connectionId,
    accept,
  });
  if (error) {
    throw new Error(friendly[error.message] ?? fallback);
  }
}
