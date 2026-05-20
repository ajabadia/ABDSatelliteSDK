import { cookies } from 'next/headers';
import { verifyToken } from './utils/crypto';
import type { FederatedSession } from './types';

/**
 * 🛰️ Retrieves the current federated session from the abd_session cookie.
 * Decrypts and verifies the JWT.
 */
export async function getIndustrialSession(customSecret?: string): Promise<FederatedSession> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('abd_session');
    
    if (!sessionCookie?.value) {
      return { authenticated: false };
    }

    const payload = await verifyToken(sessionCookie.value, customSecret);
    if (!payload) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        surname: payload.surname,
        role: payload.role,
        tenantId: payload.tenantId,
        dbPrefix: payload.dbPrefix,
        isolationStrategy: payload.isolationStrategy,
        permissions: payload.permissions || [],
        allowedApps: payload.allowedApps || [],
      }
    };
  } catch (error) {
    return { authenticated: false };
  }
}

/**
 * 🛡️ Assertion Helper
 * Throws an error if the user is not authenticated or lacks the required role.
 * Accounts for SUPER_ADMIN role bypass.
 */
export async function ensureIndustrialAccess(requiredRole?: string, customSecret?: string) {
  const session = await getIndustrialSession(customSecret);
  
  if (!session.authenticated || !session.user) {
    throw new Error('UNAUTHORIZED_ECOSYSTEM_ACCESS');
  }

  if (requiredRole && session.user.role !== requiredRole && session.user.role !== 'SUPER_ADMIN') {
    throw new Error('INSUFFICIENT_INDUSTRIAL_PRIVILEGES');
  }

  return session.user;
}
