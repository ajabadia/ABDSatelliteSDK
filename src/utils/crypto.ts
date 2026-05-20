import { jwtVerify, type JWTPayload } from 'jose';

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
}

function getSecretKey(customSecret?: string): Uint8Array {
  const secret = customSecret || process.env.AUTH_JWT_SECRET || 'abd-auth-industrial-fallback-secret-2026';
  return new TextEncoder().encode(secret);
}

/**
 * 🛡️ Verify JWT signature and expiration.
 * Returns the decoded payload or null if invalid/expired.
 */
export async function verifyToken(token: string, customSecret?: string): Promise<VerifiedTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(customSecret));
    return payload as VerifiedTokenPayload;
  } catch (err) {
    return null;
  }
}
