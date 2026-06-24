/**
 * @purpose Gestiona la estructura para opciones de limitador de velocidad.
 * @purpose_en Defines the structure for rate limiter options.
 * @refactorable false
 * @classification Type Definition
 * @complexity Low
 * @fingerprint exports:1,imports:0,sig:u4aye8
 * @lastUpdated 2026-06-23T23:25:44.344Z
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
