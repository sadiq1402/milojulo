import type { Session } from '@supabase/supabase-js';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
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
  useEffect(
    () => onSessionChange(session => setState({ session, loading: false })),
    [],
  );
  return (
    <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
