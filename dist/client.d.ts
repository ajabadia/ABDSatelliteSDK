import React from 'react';
import { F as FederatedSession } from './types-BnY5DCNp.js';
import 'next/server';

interface ClientSessionContext {
    session: FederatedSession;
    status: 'authenticated' | 'unauthenticated' | 'loading';
    update: () => Promise<void>;
}
interface SessionProviderProps {
    children: React.ReactNode;
    initialSession?: FederatedSession;
}
/**
 * 🛰️ Context Provider for Client Session state.
 * Supports SSR hydration and client-side reactive fetching/mutation.
 */
declare const SessionProvider: React.FC<SessionProviderProps>;
declare function useSession(): ClientSessionContext;

export { SessionProvider, useSession };
