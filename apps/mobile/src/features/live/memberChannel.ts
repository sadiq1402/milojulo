import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export type LiveStatus = 'live' | 'offline';
export type MemberEvent = { event: string; payload: Record<string, unknown> };
type Listener = {
  onEvent?: (event: MemberEvent) => void;
  onStatus?: (status: LiveStatus) => void;
};

const listeners = new Set<Listener>();
let current: { channel: RealtimeChannel | null; closed: boolean } | null = null;
let status: LiveStatus = 'offline';

// The signed-in Member's one private channel (Broadcast from database triggers), shared by
// every listener; it opens with the first and closes with the last. 'live' fires on every
// (re)subscribe, which is when to catch up on anything missed.
export function listenToMember(listener: Listener): () => void {
  listeners.add(listener);
  if (!current) {
    open();
  } else if (status === 'live') {
    listener.onStatus?.('live');
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      close();
    }
  };
}

function open() {
  const state: NonNullable<typeof current> = { channel: null, closed: false };
  current = state;
  (async () => {
    const { data } = await supabase.auth.getSession();
    const memberId = data.session?.user.id;
    await supabase.realtime.setAuth();
    if (!memberId || state.closed) {
      return;
    }
    const channel = supabase.channel(`member:${memberId}`, {
      config: { private: true },
    });
    channel.on('broadcast', { event: '*' }, ({ event, payload }) =>
      listeners.forEach(l => l.onEvent?.({ event, payload })),
    );
    state.channel = channel;
    channel.subscribe(subscribed => {
      status = subscribed === 'SUBSCRIBED' ? 'live' : 'offline';
      listeners.forEach(l => l.onStatus?.(status));
    });
  })().catch(() => {});
}

function close() {
  if (current) {
    current.closed = true;
    if (current.channel) {
      supabase.removeChannel(current.channel);
    }
    current = null;
    status = 'offline';
  }
}
