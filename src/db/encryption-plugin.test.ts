import { describe, it, expect, vi } from 'vitest';
import { Schema } from 'mongoose';

describe('Mongoose Encryption Plugin', () => {
  it('should register save, init, and find hooks', async () => {
    process.env.ENCRYPTION_SECRET = 'test-secret-key-12345678901234567890';
    const { encryptionPlugin } = await import('./encryption-plugin');

    const schema = new Schema();
    const preSpy = vi.spyOn(schema, 'pre');
    const postSpy = vi.spyOn(schema, 'post');

    encryptionPlugin(['piiField', 'nested.secret'])(schema);

    expect(preSpy).toHaveBeenCalledWith('save', expect.any(Function));
    expect(postSpy).toHaveBeenCalledWith('init', expect.any(Function));
    expect(postSpy).toHaveBeenCalledWith('find', expect.any(Function));
  });

  it('should encrypt and decrypt using SecurityService', async () => {
    process.env.ENCRYPTION_SECRET = 'test-secret-key-12345678901234567890';
    const { SecurityService } = await import('../core/security');

    const originalText = 'PII Data';
    const encrypted = SecurityService.encrypt(originalText);
    expect(encrypted).toContain(':');
    const decrypted = SecurityService.decrypt(encrypted);
    expect(decrypted).toBe(originalText);
  });
});
