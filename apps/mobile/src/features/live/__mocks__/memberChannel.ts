import type { LiveStatus, MemberEvent } from '../memberChannel';

type Listener = Parameters<typeof import('../memberChannel').listenToMember>[0];

// Jest stands in for Realtime: tests send events and status changes to every listener.
const listeners = new Set<Listener>();

export function listenToMember(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitMemberEvent(event: MemberEvent) {
  listeners.forEach(l => l.onEvent?.(event));
}

export function emitMemberStatus(status: LiveStatus) {
  listeners.forEach(l => l.onStatus?.(status));
}
