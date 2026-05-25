import { cookies } from 'next/headers';
import { verifyToken } from './utils/crypto';
import { FederatedSessionSchema } from './utils/schemas.js';
import { logger } from './utils/logger';
import type { FederatedSession } from './types';

export class UnauthorizedAccessError extends Error {
  constructor(message = 'UNAUTHORIZED_ECOSYSTEM_ACCESS') {
    super(message);
    this.name = 'UnauthorizedAccessError';
  }
}

export class InsufficientPrivilegesError extends Error {
  constructor(message = 'INSUFFICIENT_INDUSTRIAL_PRIVILEGES') {
    super(message);
    this.name = 'InsufficientPrivilegesError';
  }
}

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

    // Validate the payload structure with Zod before returning
    // Note: name and surname are optional in the schema to handle cases where JWT doesn't include them
    // We ensure they are strings (not undefined) by using fallback empty strings
    const userName = payload.name ?? '';
    const userSurname = payload.surname ?? '';
    const parsedPayload = FederatedSessionSchema.safeParse({
      authenticated: true,
      user: {
        id: payload.sub as string,
        email: payload.email as string,
        name: userName,
        surname: userSurname,
        role: payload.role as string,
        tenantId: payload.tenantId as string,
        dbPrefix: (payload.dbPrefix || '') as string,
        isolationStrategy: (payload.isolationStrategy || 'DATABASE_PER_TENANT') as string,
        permissions: (payload.permissions || []) as string[],
        allowedApps: (payload.allowedApps || []) as string[],
        sessionId: payload.sessionId as string | undefined,
      },
    });

    if (!parsedPayload.success) {
      if (process.env.NODE_ENV !== 'production') {
        logger.error('[SDK_GET_SESSION_ERROR] Payload validation failed', parsedPayload.error);
      }
      return { authenticated: false };
    }

    // Cast to FederatedSession to satisfy TypeScript - name/surname are guaranteed non-empty via our fallbacks
    return parsedPayload.data as FederatedSession;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[SDK_GET_SESSION_ERROR] Failed to retrieve industrial session:', error instanceof Error ? error.message : error);
    }
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
    throw new UnauthorizedAccessError();
  }

  if (requiredRole && session.user.role !== requiredRole && session.user.role !== 'SUPER_ADMIN') {
    throw new InsufficientPrivilegesError();
  }

  return session.user;
}
