/**
 * @purpose Gestiona solicitudes HTTP con lógica de retry exponencial, incorporando límites de velocidad y patrones de fallido.
 * @purpose_en Manages HTTP requests with exponential backoff retry logic, incorporating rate limiting and circuit breaker patterns.
 * @refactorable true (contains too many state variables and UI parts)
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:1,imports:4,sig:f8neh4
 * @lastUpdated 2026-06-23T23:25:27.076Z
 */

import { logger } from './logger';
import { idpRateLimiter } from './rateLimiter';
import { idpCircuitBreaker } from './circuitBreaker';
import type { NextFetchRequestInit, FetchRetryResult } from '../types';

/**
 * 🔁 Fetch with exponential backoff retry logic.
 * Retries on network errors and 5xx server errors with jitter to prevent thundering herd.
 */
export async function fetchWithRetry<T>(
  url: string,
  options: NextFetchRequestInit = {},
  maxAttempts: number = 4,
  baseDelayMs: number = 100,
  maxDelayMs: number = 5000
): Promise<FetchRetryResult<T>> {
  let lastError: Error | null = null;
  let circuitRecorded = false;

  if (!idpCircuitBreaker.canExecute()) {
    const waitTime = idpCircuitBreaker.getTimeUntilRetry();
    logger.warn(`[SDK_CIRCUIT_BREAKER] Circuit is OPEN. Request blocked. Retry in ${waitTime}ms.`);
    return { ok: false, error: `Circuit breaker is open. IdP unavailable. Retry in ${Math.ceil(waitTime / 1000)}s.` };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      try { await idpRateLimiter.waitForToken('idp'); }
      catch (rateLimitErr) {
        const errMsg = rateLimitErr instanceof Error ? rateLimitErr.message : String(rateLimitErr);
        logger.error(`[SDK_RATE_LIMIT] Request blocked: ${errMsg}`, rateLimitErr);
        return { ok: false, error: `Rate limit exceeded: ${errMsg}` };
      }

      const res = await fetch(url, options);

      if (!res.ok && res.status >= 500) {
        lastError = new Error(`Server error: ${res.status}`);
        if (attempt < maxAttempts - 1) {
          const backoffDelay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
          const jitter = Math.random() * baseDelayMs * 0.5;
          const delay = Math.floor(backoffDelay + jitter);
          logger.warn(`[SDK_RETRY] Attempt ${attempt + 1} failed with ${res.status}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        logger.error(`[SDK_RETRY] Final attempt (${attempt + 1}/${maxAttempts}) failed with ${res.status}`, lastError);
        if (!circuitRecorded) { idpCircuitBreaker.recordFailure(); circuitRecorded = true; }
        return { ok: false, status: res.status, error: lastError.message };
      }

      if (res.ok && !circuitRecorded) { idpCircuitBreaker.recordSuccess(); circuitRecorded = true; }
      const data = res.ok ? await res.json().catch(() => null) : null;
      return { ok: res.ok, data, status: res.status };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts - 1) {
        const backoffDelay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = Math.random() * baseDelayMs * 0.5;
        const delay = Math.floor(backoffDelay + jitter);
        logger.warn(`[SDK_RETRY] Attempt ${attempt + 1} failed with error: ${lastError.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  if (!circuitRecorded) { idpCircuitBreaker.recordFailure(); circuitRecorded = true; }
  logger.error(`[SDK_RETRY] All ${maxAttempts} attempts failed. Last error`, lastError);
  return { ok: false, error: lastError?.message };
}
