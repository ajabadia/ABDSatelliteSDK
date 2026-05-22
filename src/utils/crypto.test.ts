import { describe, it, expect, vi } from 'vitest';
import { verifyToken } from './crypto.js';
import { SignJWT } from 'jose';

describe('verifyToken', () => {
  const secretString = 'super-secret-key-for-testing-12345';
  const secretKey = new TextEncoder().encode(secretString);

  const validPayload = {
    sub: 'user-1',
    email: 'test@example.com',
    name: 'John',
    surname: 'Doe',
    role: 'USER',
    tenantId: 'tenant-1',
    permissions: ['read', 'write'],
    dbPrefix: 't1_',
    isolationStrategy: 'schema',
    allowedApps: ['app1']
  };

  it('should verify a valid token with custom secret', async () => {
    const token = await new SignJWT(validPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secretKey);

    const result = await verifyToken(token, secretString);
    expect(result).not.toBeNull();
    expect(result?.email).toBe('test@example.com');
  });

  it('should verify a valid token with env secret', async () => {
    vi.stubEnv('AUTH_JWT_SECRET', secretString);
    
    const token = await new SignJWT(validPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secretKey);

    const result = await verifyToken(token);
    expect(result).not.toBeNull();
    expect(result?.tenantId).toBe('tenant-1');
    
    vi.unstubAllEnvs();
  });

  it('should throw if no secret is provided', async () => {
    // Both env and customSecret are empty
    vi.stubEnv('AUTH_JWT_SECRET', '');
    const result = await verifyToken('some-token');
    // verifyToken catches the error and returns null
    expect(result).toBeNull();
    vi.unstubAllEnvs();
  });

  it('should return null for expired tokens', async () => {
    const token = await new SignJWT(validPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('-1h') // expired 1 hour ago
      .sign(secretKey);

    const result = await verifyToken(token, secretString);
    expect(result).toBeNull();
  });

  it('should return null for malformed tokens', async () => {
    const result = await verifyToken('not-a-valid-jwt', secretString);
    expect(result).toBeNull();
  });

  it('should return null for invalid payload schema', async () => {
    const invalidPayload = { sub: 'user-1' }; // missing required fields
    const token = await new SignJWT(invalidPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secretKey);

    const result = await verifyToken(token, secretString);
    expect(result).toBeNull();
  });
});
