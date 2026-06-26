/**
 * @purpose Gestiona y valida la sesión industrial al recuperarla de una cookie, descriptografándola y asegurando la autenticación del usuario y sus privilegios.
 * @purpose_en Manages and validates the industrial session by retrieving it from a cookie, decrypting it, and ensuring user authentication and privileges.
 * @refactorable true (contains too many state variables and UI parts)
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:4,imports:6,sig:tie6xn
 * @lastUpdated 2026-06-26T10:03:54.892Z
 */

import { cookies } from 'next/headers';
import { verifyToken } from '../core/crypto';
import { FederatedSessionSchema } from '../core/schemas.js';
import { logger } from '../utils/logger';
import type { FederatedSession } from '../types';
import { getCache, setCache, sessionCacheKey, hashToken } from './session/redis-store';

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

    // 1. Try Redis cache first
    const cacheKey = sessionCacheKey(await hashToken(sessionCookie.value));
    const cached = await getCache<FederatedSession>(cacheKey);
    if (cached) return cached;

    // 2. Verify JWT (cache miss)
    const payload = await verifyToken(sessionCookie.value, customSecret);
    if (!payload) {
      return { authenticated: false };
    }

    // 3. Validate the payload structure with Zod
    const parsedPayload = FederatedSessionSchema.safeParse({
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
        permissions: payload.permissions,
        allowedApps: payload.allowedApps,
        sessionId: payload.sessionId,
      },
    });

    if (!parsedPayload.success) {
      if (process.env.NODE_ENV !== 'production') {
        logger.error('[SDK_GET_SESSION_ERROR] Payload validation failed', parsedPayload.error);
      }
      return { authenticated: false };
    }

    // 4. Populate Redis cache (8h TTL — matches JWT expiry)
    await setCache(cacheKey, parsedPayload.data, 60 * 60 * 8);

    return parsedPayload.data;
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
