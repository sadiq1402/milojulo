import type { Session } from '@supabase/supabase-js';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { forgetCache } from '../../lib/persistCache';
import { onSessionChange } from './api';

type SessionState = { session: Session | null; loading: boolean };

const SessionContext = createContext<SessionState>({
  session: null,
  loading: true,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    session: null,
    loading: true,
  });
  const client = useQueryClient();
  useEffect(
    () =>
      onSessionChange(session => {
        // Signed out (or deleted): nothing the account loaded may stay for the next one.
        if (!session) {
          client.clear();
          forgetCache().catch(() => {});
        }
        setState({ session, loading: false });
      }),
    [client],
  );
  return (
    <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
