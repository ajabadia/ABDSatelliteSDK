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
