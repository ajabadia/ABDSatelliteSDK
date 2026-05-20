'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { FederatedSession, UserProfile } from '../types';

export interface ClientSessionContext {
  session: FederatedSession;
  status: 'authenticated' | 'unauthenticated' | 'loading';
  update: () => Promise<void>;
}

const SessionContext = createContext<ClientSessionContext | undefined>(undefined);

interface SessionProviderProps {
  children: React.ReactNode;
  initialSession?: FederatedSession;
}

/**
 * 🛰️ Context Provider for Client Session state.
 * Supports SSR hydration and client-side reactive fetching/mutation.
 */
export const SessionProvider: React.FC<SessionProviderProps> = ({
  children,
  initialSession
}) => {
  const [session, setSession] = useState<FederatedSession>(
    initialSession || { authenticated: false }
  );
  const [status, setStatus] = useState<'authenticated' | 'unauthenticated' | 'loading'>(
    initialSession
      ? (initialSession.authenticated ? 'authenticated' : 'unauthenticated')
      : 'loading'
  );

  const fetchSession = async () => {
    try {
      setStatus('loading');
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as FederatedSession;
        setSession(data);
        setStatus(data.authenticated ? 'authenticated' : 'unauthenticated');
      } else {
        setSession({ authenticated: false });
        setStatus('unauthenticated');
      }
    } catch (err) {
      console.error('[SDK_CLIENT_SESSION_FETCH_ERROR]', err);
      setSession({ authenticated: false });
      setStatus('unauthenticated');
    }
  };

  // If no initial session is passed down, fetch it immediately on mount
  useEffect(() => {
    if (!initialSession) {
      fetchSession();
    }
  }, [initialSession]);

  return (
    <SessionContext.Provider value={{ session, status, update: fetchSession }}>
      {children}
    </SessionContext.Provider>
  );
};

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
