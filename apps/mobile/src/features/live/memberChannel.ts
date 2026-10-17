import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export type LiveStatus = 'live' | 'offline';
export type MemberEvent = { event: string; payload: Record<string, unknown> };
type Listener = {
  onEvent?: (event: MemberEvent) => void;
  onStatus?: (status: LiveStatus) => void;
};

const listeners = new Set<Listener>();
let openChannel: { channel: RealtimeChannel | null; closed: boolean } | null =
  null;
let status: LiveStatus = 'offline';

// One shared channel: opens with the first listener, closes with the last; 'live' means catch up.
export function listenToMember(listener: Listener): () => void {
  listeners.add(listener);
  if (!openChannel) {
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

function notify(next: LiveStatus) {
  status = next;
  listeners.forEach(l => l.onStatus?.(next));
}

function open() {
  const opening: NonNullable<typeof openChannel> = {
    channel: null,
    closed: false,
  };
  openChannel = opening;
  (async () => {
    const { data } = await supabase.auth.getSession();
    const memberId = data.session?.user.id;
    if (!memberId) {
      throw new Error('signed out');
    }
    await supabase.realtime.setAuth();
    if (opening.closed) {
      return;
    }
    const channel = supabase.channel(`member:${memberId}`, {
      config: { private: true },
    });
    channel.on('broadcast', { event: '*' }, ({ event, payload }) =>
      listeners.forEach(l => l.onEvent?.({ event, payload })),
    );
    opening.channel = channel;
    channel.subscribe(subscribed => {
      // A removed channel still reports CLOSED; only the open one speaks.
      if (openChannel === opening) {
        notify(subscribed === 'SUBSCRIBED' ? 'live' : 'offline');
      }
    });
  })().catch(() => {
    // Not opened: the next listener tries again.
    if (openChannel === opening) {
      openChannel = null;
      notify('offline');
    }
  });
}

function close() {
  if (openChannel) {
    openChannel.closed = true;
    if (openChannel.channel) {
      supabase.removeChannel(openChannel.channel);
    }
    openChannel = null;
    status = 'offline';
  }
}
