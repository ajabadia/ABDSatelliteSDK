import React from 'react';
import { F as FederatedSession } from './types-CLrrtVBg.mjs';
import 'next/server';

interface ClientSessionContext {
    session: FederatedSession;
    status: 'authenticated' | 'unauthenticated' | 'loading';
    update: () => Promise<void>;
}
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
declare const SessionProvider: React.FC<SessionProviderProps>;
declare function useSession(): ClientSessionContext;

export { SessionProvider, useSession };
