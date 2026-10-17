import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import type { Mode } from '../modes';
import { listenToMember, type LiveStatus } from '../live/memberChannel';
import { toMessageMedia } from './messages';

type Enums = Database['public']['Enums'];

export type Conversation = {
  connectionId: string;
  otherId: string;
  otherName: string;
  otherPhotoId: string | null;
  otherAreaId: string | null;
  mode: Mode;
  status: Enums['connection_status'];
  direction: Enums['connection_direction'];
  note: string | null;
  lastMessage: {
    type: Enums['message_type'];
    body: string | null;
    at: string;
  } | null;
  unreadCount: number;
};

// The caller's Connections, newest activity first (requests, chats and closed history).
export async function fetchConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc('my_connections');
  if (error) {
    throw error;
  }
  return data.map(row => ({
    connectionId: row.connection_id,
    otherId: row.other_id,
    otherName: row.other_name,
    otherPhotoId: row.other_photo_id,
    otherAreaId: row.other_area_id,
    mode: row.mode,
    status: row.status,
    direction: row.direction,
    note: row.note,
    lastMessage: row.last_message_at
      ? {
          type: row.last_message_type,
          body: row.last_message_body,
          at: row.last_message_at,
        }
      : null,
    unreadCount: row.unread_count,
  }));
}

export type Message = {
  id: string;
  connectionId: string;
  senderId: string;
  type: Enums['message_type'];
  body: string | null;
  activityId: string | null;
  createdAt: string;
  // Images, video and voice notes; the file itself comes by signed link (fetchMediaUrls).
  media: MessageMedia | null;
};

export type MessageMedia = {
  mime: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  // Media Expiry: the file was deleted (90 days); the message stays.
  expired: boolean;
};

const messageColumns =
  'id, connection_id, sender_id, type, body, activity_id, created_at, media_mime, media_width, media_height, media_duration_ms, media_deleted_at';

type MessageRow = Pick<
  Database['public']['Tables']['messages']['Row'],
  | 'id'
  | 'connection_id'
  | 'sender_id'
  | 'type'
  | 'body'
  | 'activity_id'
  | 'created_at'
  | 'media_mime'
  | 'media_width'
  | 'media_height'
  | 'media_duration_ms'
  | 'media_deleted_at'
>;

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    connectionId: row.connection_id,
    senderId: row.sender_id,
    type: row.type,
    body: row.body,
    activityId: row.activity_id,
    createdAt: row.created_at,
    media: toMessageMedia(row.type, row),
  };
}

// Oldest first; `since` fetches only the catch-up window after a reconnect.
export async function fetchMessages(
  connectionId: string,
  since?: string,
): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select(messageColumns)
    .eq('connection_id', connectionId)
    .is('removed_at', null)
    .order('created_at');
  if (since) {
    query = query.gte('created_at', since);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data.map(toMessage);
}

// Made on the phone so a retried send reuses it. Hermes has no crypto.randomUUID, and the
// id only needs to be unique, not secret.
export function newMessageId(): string {
  const crypto = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r % 4) + 8).toString(16);
  });
}

export const cannotSendMessage =
  "You can't send messages in this chat any more.";

// A repeat of an id the database already has means an earlier attempt got through.
export async function sendMessage(message: {
  id: string;
  connectionId: string;
  body: string;
}): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    id: message.id,
    connection_id: message.connectionId,
    type: 'text',
    body: message.body,
  });
  if (!error || error.code === '23505') {
    return;
  }
  throw error.code === '42501' ? new Error(cannotSendMessage) : error;
}

async function myId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session!.user.id;
}

// Marks everything up to the newest message seen; its server time, not the phone's clock.
export async function markRead(
  connectionId: string,
  upTo: string,
): Promise<void> {
  const { error } = await supabase
    .from('connection_members')
    .update({ last_read_at: upTo })
    .eq('connection_id', connectionId)
    .eq('user_id', await myId());
  if (error) {
    throw error;
  }
}

export type ChatState = { otherLastReadAt: string | null; muted: boolean };

// The other side's read position (for the read receipt) and my own Mute.
export async function fetchChatState(connectionId: string): Promise<ChatState> {
  const [me, { data, error }] = await Promise.all([
    myId(),
    supabase
      .from('connection_members')
      .select('user_id, last_read_at, muted')
      .eq('connection_id', connectionId),
  ]);
  if (error) {
    throw error;
  }
  return {
    otherLastReadAt: data.find(row => row.user_id !== me)?.last_read_at ?? null,
    muted: data.find(row => row.user_id === me)?.muted ?? false,
  };
}

export type ChatStatus = LiveStatus;

// New messages in one Connection, from the Member's private channel.
export function subscribeToChat(
  connectionId: string,
  handlers: {
    onMessage: (message: Message) => void;
    onStatus?: (status: ChatStatus) => void;
  },
): () => void {
  return listenToMember({
    onEvent: ({ event, payload }) => {
      const row = payload as MessageRow & { removed_at: string | null };
      if (
        event === 'message' &&
        row.connection_id === connectionId &&
        !row.removed_at
      ) {
        handlers.onMessage(toMessage(row));
      }
    },
    onStatus: handlers.onStatus,
  });
}

// Mute only silences push notifications for me; the other side isn't told.
export async function setMuted(
  connectionId: string,
  muted: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('connection_members')
    .update({ muted })
    .eq('connection_id', connectionId)
    .eq('user_id', await myId());
  if (error) {
    throw error;
  }
}

export async function closeConnection(connectionId: string): Promise<void> {
  const { error } = await supabase.rpc('close_connection', {
    connection_id: connectionId,
  });
  if (error) {
    throw error;
  }
}

// Also closes the pair's Connection.
export async function blockMember(memberId: string): Promise<void> {
  const { error } = await supabase.rpc('block_user', { member_id: memberId });
  if (error) {
    // block_user has no refusals of its own, so any failure is the connection.
    throw new Error("That didn't work. Check your connection and try again.");
  }
}

// Mode Change (#11): proposals to move an accepted Connection to another Eligible Mode.

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
    "There's already a Mode Change waiting for an answer.",
  'your last mode change was declined recently':
    'Your last Mode Change was declined. You can suggest another in 7 days.',
  'that mode is not open between you': "That Mode isn't open between you two.",
  'the connection is already in that mode':
    'This chat is already in that Mode.',
  'no connection to change': "This chat is closed, so its Mode can't change.",
  'no mode change to answer':
    'This Mode Change is no longer waiting for an answer.',
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
