/**
 * @purpose Valida y decodifica los tokens JWT.
 * @purpose_en Validates JWT tokens and decodes their payloads.
 * @refactorable false
 * @classification Helper Utility
 * @complexity Low
 * @fingerprint exports:2,imports:2,sig:14o1kl
 * @lastUpdated 2026-06-23T23:25:19.177Z
 */

import { jwtVerify, type JWTPayload } from 'jose';
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
