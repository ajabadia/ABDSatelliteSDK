/**
 * @purpose Gestiona límites de velocidad para solicitudes API utilizando un algoritmo de bolsillo de tokens.
 * @purpose_en Manages rate limiting for API requests using a token bucket algorithm.
 * @refactorable false
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:4,imports:2,sig:1jz1com
 * @lastUpdated 2026-06-23T20:33:16.060Z
 */

import { logger } from './logger';
import type { RateLimiterOptions } from './rateLimiterTypes';
export type { RateLimiterOptions } from './rateLimiterTypes';

export class RateLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private readonly refillRate: number;
  private readonly maxTokens: number;
  private readonly minDelayMs: number;

  constructor(options: RateLimiterOptions = {}) {
    const { requestsPerSecond = 10, burstSize = 20, minDelayMs = 50 } = options;
    this.refillRate = requestsPerSecond / 1000;
    this.maxTokens = burstSize;
    this.minDelayMs = minDelayMs;
  }

  tryAcquire(key: string = 'global'): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket) { bucket = { tokens: this.maxTokens, lastRefill: now }; this.buckets.set(key, bucket); }

    const timePassed = now - bucket.lastRefill;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + timePassed * this.refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) { bucket.tokens -= 1; return true; }

    const waitTimeMs = Math.ceil((1 - bucket.tokens) / this.refillRate);
    logger.warn(`[SDK_RATE_LIMIT] Request blocked for key '${key}'. Wait ${waitTimeMs}ms. Tokens: ${bucket.tokens.toFixed(2)}`);
    return false;
  }

  async waitForToken(key: string = 'global', maxWaitMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (!this.tryAcquire(key)) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= maxWaitMs) {
        logger.error(`[SDK_RATE_LIMIT] Wait timeout after ${maxWaitMs}ms for key '${key}'`, new Error('Rate limit timeout'));
        throw new Error(`Rate limit wait timeout after ${maxWaitMs}ms for key '${key}'`);
      }
      await new Promise<void>(resolve => setTimeout(resolve, Math.min(this.minDelayMs, maxWaitMs - elapsed)));
    }
  }

  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> { await this.waitForToken(key); return fn(); }

  getTokens(key: string = 'global'): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.maxTokens;
    return Math.min(this.maxTokens, bucket.tokens + (Date.now() - bucket.lastRefill) * this.refillRate);
  }

  reset(key?: string): void { key ? this.buckets.delete(key) : this.buckets.clear(); }
  getTrackedKeysCount(): number { return this.buckets.size; }
}

export const idpRateLimiter = new RateLimiter({
  requestsPerSecond: Number(process.env.SDK_RATE_LIMIT_RPS) || 10,
  burstSize: Number(process.env.SDK_RATE_LIMIT_BURST) || 20,
  minDelayMs: Number(process.env.SDK_RATE_LIMIT_MIN_DELAY) || 50,
});

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  return new RateLimiter(options);
}
