import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Enums = Database['public']['Enums'];

export type Conversation = {
  connectionId: string;
  otherId: string;
  otherName: string;
  otherPhotoId: string | null;
  otherAreaId: string | null;
  mode: Enums['mode'];
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
};

const messageColumns =
  'id, connection_id, sender_id, type, body, activity_id, created_at';

type MessageRow = Pick<
  Database['public']['Tables']['messages']['Row'],
  | 'id'
  | 'connection_id'
  | 'sender_id'
  | 'type'
  | 'body'
  | 'activity_id'
  | 'created_at'
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

export type ChatStatus = 'live' | 'offline';

// New messages on the Connection's private channel (Broadcast from a database trigger).
// 'live' fires on every (re)subscribe, which is when to catch up on anything missed.
export function subscribeToChat(
  connectionId: string,
  handlers: {
    onMessage: (message: Message) => void;
    onStatus?: (status: ChatStatus) => void;
  },
): () => void {
  const channel = supabase.channel(`connection:${connectionId}`, {
    config: { private: true },
  });
  channel.on('broadcast', { event: 'message' }, ({ payload }) => {
    const row = payload as MessageRow & { removed_at: string | null };
    if (!row.removed_at) {
      handlers.onMessage(toMessage(row));
    }
  });
  supabase.realtime
    .setAuth()
    .then(() =>
      channel.subscribe(status =>
        handlers.onStatus?.(status === 'SUBSCRIBED' ? 'live' : 'offline'),
      ),
    );
  return () => {
    supabase.removeChannel(channel);
  };
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
    throw error;
  }
}
