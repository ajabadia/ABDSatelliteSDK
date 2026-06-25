'use client';

/**
 * @purpose Gestiona y proporciona estado de sesión del cliente para autenticación, incluyendo recuperar, actualizar y manejar cambios de sesión.
 * @purpose_en Manages and provides client session state for authentication, including fetching, updating, and handling session changes.
 * @refactorable true (contains too many state variables and UI parts)
 * @classification Context/Provider
 * @complexity Medium
 * @fingerprint exports:3,imports:3,sig:fr8lqz
 * @lastUpdated 2026-06-23T23:24:16.857Z
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { FederatedSession, UserProfile } from '../types';
import { FederatedSessionSchema } from '../core/schemas.js';

export interface ClientSessionContext {
  session: FederatedSession;
  status: 'authenticated' | 'unauthenticated' | 'loading';
  update: () => Promise<void>;
}

const SessionContext = createContext<ClientSessionContext | undefined>(undefined);

interface SessionProviderProps {
  children: React.ReactNode;
  initialSession?: FederatedSession;
  /** Whether to automatically refetch session when window regains focus */
  refetchOnWindowFocus?: boolean;
  /** Polling interval in milliseconds (0 = disabled) */
  pollInterval?: number;
}

/**
 * 🛰️ Context Provider for Client Session state.
 * Supports SSR hydration and client-side reactive fetching/mutation.
 */
export const SessionProvider: React.FC<SessionProviderProps> = ({
  children,
  initialSession,
  refetchOnWindowFocus = true,
  pollInterval = 0
}) => {
  const [session, setSession] = useState<FederatedSession>(
    initialSession || { authenticated: false }
  );
  const [status, setStatus] = useState<'authenticated' | 'unauthenticated' | 'loading'>(
    initialSession
      ? (initialSession.authenticated ? 'authenticated' : 'unauthenticated')
      : 'loading'
  );

  const fetchSession = async (quiet = false) => {
    try {
      if (!quiet) setStatus('loading');
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      if (res.ok) {
        const rawData = await res.json();
        const data = FederatedSessionSchema.parse(rawData) as FederatedSession;
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

  // Window Focus Revalidation
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchSession(true);
      }
    };

    const handleFocus = () => {
      fetchSession(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refetchOnWindowFocus]);

  // Polling Revalidation
  useEffect(() => {
    if (pollInterval <= 0) return;
    
    const interval = setInterval(() => {
      fetchSession(true);
    }, pollInterval);
    
    return () => clearInterval(interval);
  }, [pollInterval]);

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
