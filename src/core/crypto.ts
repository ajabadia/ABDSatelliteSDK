/**
 * @purpose Valida y genera tokens JWT.
 * @purpose_en Validates JWT tokens, decodes their payloads, and generates new tokens.
 * @refactorable false
 * @classification Helper Utility
 * @complexity Low
 * @fingerprint exports:4,imports:2,sig:1w3o3h5
 * @lastUpdated 2026-06-26T10:03:56.265Z
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { VerifiedTokenPayloadSchema } from './schemas.js';

export interface VerifiedTokenPayload extends JWTPayload {
  sub: string;
  email: string;
  name: string;
  surname: string;
  role: string;
  tenantId: string;
  permissions: string[];
  dbPrefix: string;
  isolationStrategy: string;
  allowedApps?: string[];
  sessionId?: string;
}

export interface TokenPayloadInput {
  sub: string;
  email: string;
  name?: string;
  surname?: string;
  tenantId: string;
  role: string;
  permissions?: string[];
  dbPrefix?: string;
  isolationStrategy?: string;
  allowedApps?: string[];
  groups?: string[];
  sessionId?: string;
}

function getSecretKey(customSecret?: string): Uint8Array {
  const secret = customSecret || process.env.AUTH_JWT_SECRET;
  if (!secret) throw new Error('[SDK] AUTH_JWT_SECRET is required');
  return new TextEncoder().encode(secret);
}

/**
 * 🛡️ Verify JWT signature and expiration.
 * Returns the decoded payload or null if invalid/expired.
 */
export async function verifyToken(token: string, customSecret?: string): Promise<VerifiedTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(customSecret));
    return VerifiedTokenPayloadSchema.parse(payload) as VerifiedTokenPayload;
  } catch (err) {
    console.error("[SDK_JWT_VERIFY_ERROR] Failed to verify token:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * 🪙 Generate a signed JWT for development/sandbox purposes.
 * Uses the same AUTH_JWT_SECRET as the rest of the ecosystem.
 */
export async function generateToken(payload: TokenPayloadInput, customSecret?: string): Promise<string> {
  return await new SignJWT({
    sub: payload.sub,
    email: payload.email,
    name: payload.name || '',
    surname: payload.surname || '',
    tenantId: payload.tenantId,
    role: payload.role,
    permissions: payload.permissions || [],
    dbPrefix: payload.dbPrefix || '',
    isolationStrategy: payload.isolationStrategy || 'COLLECTION_PREFIX',
    allowedApps: payload.allowedApps || [],
    groups: payload.groups || [],
    ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(getSecretKey(customSecret));
}
