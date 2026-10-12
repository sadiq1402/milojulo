import type { Session } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import React from 'react';
import App from '../src/App';
import * as auth from '../src/features/auth/api';

// A session as Supabase Auth hands it to the app.
export function sessionFor(email: string): Session {
  return { user: { id: `id-${email}`, email } } as Session;
}

// Renders the whole app with the given session already restored. setSession plays a later auth
// change; call it from a mocked data function, which already runs inside the event's act().
export async function renderApp(session: Session | null) {
  let emit: (next: Session | null) => void = () => {};
  jest.mocked(auth.onSessionChange).mockImplementation(listener => {
    emit = listener;
    listener(session);
    return () => {};
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const result = await render(<App client={client} />);
  const setSession = (next: Session | null) => emit(next);
  return { ...result, setSession };
}
