import { describe, it, expect } from 'vitest';
import { computeBlockHash } from './crypto-chain';

describe('computeBlockHash', () => {
  const previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const payload = {
    appId: 'test-app',
    action: 'USER_LOGIN',
    userId: 'user-123',
    status: 'SUCCESS',
  };

  it('should return a valid 64-character SHA-256 hex string', () => {
    const hash = computeBlockHash(payload, previousHash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should be deterministic and ignore object key order', () => {
    const payload1 = { a: 1, b: 2 };
    const payload2 = { b: 2, a: 1 };

    const hash1 = computeBlockHash(payload1, previousHash);
    const hash2 = computeBlockHash(payload2, previousHash);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes with and without a timestamp', () => {
    const timestamp = 1716500000000;
    const hashWithout = computeBlockHash(payload, previousHash);
    const hashWith = computeBlockHash(payload, previousHash, timestamp);

    expect(hashWithout).not.toBe(hashWith);
  });

  it('should produce different hashes for different timestamps', () => {
    const hash1 = computeBlockHash(payload, previousHash, 1000);
    const hash2 = computeBlockHash(payload, previousHash, 2000);

    expect(hash1).not.toBe(hash2);
  });
});
