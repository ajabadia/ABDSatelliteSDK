import { logger } from './logger';

/**
 * 🚦 Token Bucket Rate Limiter for SDK IdP calls.
 * 
 * Prevents overwhelming the IdP with requests by implementing a token bucket
 * algorithm that limits the rate of outgoing requests.
 * 
 * Features:
 * - Token bucket algorithm with configurable rate and burst
 * - Per-key rate limiting (e.g., per tenant)
 * - Sliding window tracking for accurate limiting
 * - Non-blocking check - returns false immediately if rate exceeded
 */
export class RateLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private readonly refillRate: number; // tokens per millisecond
  private readonly maxTokens: number;
  private readonly minDelayMs: number;

  /**
   * Create a new RateLimiter
   * 
   * @param options Configuration options
   * @param options.requestsPerSecond - Maximum sustained requests per second (default: 10)
   * @param options.burstSize - Maximum burst of requests allowed (default: 20)
   * @param options.minDelayMs - Minimum delay between requests in ms (default: 50)
   */
  constructor(options: RateLimiterOptions = {}) {
    const {
      requestsPerSecond = 10,
      burstSize = 20,
      minDelayMs = 50
    } = options;

    this.refillRate = requestsPerSecond / 1000; // tokens per ms
    this.maxTokens = burstSize;
    this.minDelayMs = minDelayMs;
  }

  /**
   * Check if a request can be made for the given key
   * 
   * @param key - The key to rate limit (e.g., tenantId, 'global')
   * @returns true if request can proceed, false if rate limited
   */
  tryAcquire(key: string = 'global'): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on time elapsed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = timePassed * this.refillRate;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if we have tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    // Calculate wait time for next token
    const waitTimeMs = Math.ceil((1 - bucket.tokens) / this.refillRate);
    logger.warn(`[SDK_RATE_LIMIT] Request blocked for key '${key}'. Wait ${waitTimeMs}ms. Tokens: ${bucket.tokens.toFixed(2)}`);
    
    return false;
  }

  /**
   * Wait until a request can be made for the given key
   * 
   * @param key - The key to rate limit
   * @param maxWaitMs - Maximum time to wait in milliseconds (default: 5000)
   * @returns Promise that resolves when request can proceed
   * @throws Error if max wait time is exceeded
   */
  async waitForToken(key: string = 'global', maxWaitMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (!this.tryAcquire(key)) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= maxWaitMs) {
        logger.error(`[SDK_RATE_LIMIT] Wait timeout after ${maxWaitMs}ms for key '${key}'`, new Error('Rate limit timeout'));
        throw new Error(`Rate limit wait timeout after ${maxWaitMs}ms for key '${key}'`);
      }
      const waitTime = Math.min(this.minDelayMs, maxWaitMs - elapsed);
      await new Promise<void>(resolve => {
        setTimeout(resolve, waitTime);
      });
    }
  }

  /**
   * Execute a function with rate limiting
   * 
   * @param key - The key to rate limit
   * @param fn - The async function to execute
   * @returns The result of the function
   */
  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    await this.waitForToken(key);
    return fn();
  }

  /**
   * Get current token count for a key (for monitoring/debugging)
   */
  getTokens(key: string = 'global'): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.maxTokens;

    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = timePassed * this.refillRate;
    
    return Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
  }

  /**
   * Reset rate limit for a key
   */
  reset(key?: string): void {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }

  /**
   * Get the number of keys being tracked
   */
  getTrackedKeysCount(): number {
    return this.buckets.size;
  }
}

/**
 * Options for RateLimiter constructor
 */
export interface RateLimiterOptions {
  /** Maximum sustained requests per second (default: 10) */
  requestsPerSecond?: number;
  /** Maximum burst of requests allowed (default: 20) */
  burstSize?: number;
  /** Minimum delay between requests in ms (default: 50) */
  minDelayMs?: number;
  /** Maximum wait time for waitForToken in ms (default: 5000) */
  maxWaitMs?: number;
}

/**
 * Global rate limiter instance for IdP calls
 * Configured with safe defaults to prevent overwhelming the IdP
 * 
 * Can be configured via environment variables:
 * - SDK_RATE_LIMIT_RPS: requests per second (default: 10)
 * - SDK_RATE_LIMIT_BURST: burst size (default: 20)
 * - SDK_RATE_LIMIT_MIN_DELAY: minimum delay in ms (default: 50)
 */
export const idpRateLimiter = new RateLimiter({
  requestsPerSecond: Number(process.env.SDK_RATE_LIMIT_RPS) || 10,
  burstSize: Number(process.env.SDK_RATE_LIMIT_BURST) || 20,
  minDelayMs: Number(process.env.SDK_RATE_LIMIT_MIN_DELAY) || 50,
});

/**
 * Create a new rate limiter with custom options
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  return new RateLimiter(options);
}