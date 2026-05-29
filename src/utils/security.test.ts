import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

describe('SecurityService', () => {
  const originalSecret = process.env.ENCRYPTION_SECRET;
  let SecurityService: typeof import('./security').SecurityService;

  beforeAll(async () => {
    // Set environment variable BEFORE importing the service to bypass module-level evaluation
    process.env.ENCRYPTION_SECRET = 'my-super-secret-key-for-testing-purposes-only';
    const mod = await import('./security');
    SecurityService = mod.SecurityService;
  });

  afterAll(() => {
    process.env.ENCRYPTION_SECRET = originalSecret;
  });

  it('should encrypt and decrypt a string successfully', () => {
    const text = 'Symmetric encryption standard';
    const encrypted = SecurityService.encrypt(text);
    
    expect(encrypted).toContain(':');
    expect(encrypted).not.toBe(text);

    const decrypted = SecurityService.decrypt(encrypted);
    expect(decrypted).toBe(text);
  });

  it('should use a random IV for each encryption (different outputs for same plaintext)', () => {
    const text = 'Same plain text';
    const enc1 = SecurityService.encrypt(text);
    const enc2 = SecurityService.encrypt(text);

    expect(enc1).not.toBe(enc2);
    expect(SecurityService.decrypt(enc1)).toBe(text);
    expect(SecurityService.decrypt(enc2)).toBe(text);
  });

  it('should return decrypted string as-is if it is not in the encrypted format (no colon)', () => {
    const plainText = 'Just standard unencrypted text';
    const decrypted = SecurityService.decrypt(plainText);
    expect(decrypted).toBe(plainText);
  });

  it('should return empty string for empty input', () => {
    expect(SecurityService.encrypt('')).toBe('');
    expect(SecurityService.decrypt('')).toBe('');
  });

  it('should throw error during encryption/decryption if ENCRYPTION_SECRET is not defined', async () => {
    // Clear module cache to allow fresh module-level evaluation of ENCRYPTION_SECRET
    vi.resetModules();
    delete process.env.ENCRYPTION_SECRET;

    const mod = await import('./security');
    const LocalSecurityService = mod.SecurityService;

    expect(() => (LocalSecurityService as unknown as { getSecret: () => Buffer }).getSecret()).toThrow('ENCRYPTION_SECRET no está definida en las variables de entorno.');
  });
});
