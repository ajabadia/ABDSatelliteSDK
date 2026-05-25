import { logger } from './logger';

/**
 * 🔌 Circuit Breaker States
 * 
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail fast without calling IdP
 * - HALF_OPEN: Testing if IdP has recovered, limited requests pass through
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * 🔌 Circuit Breaker for IdP calls.
 * 
 * Prevents cascading failures when the IdP is down by failing fast
 * instead of exhausting resources with retries.
 * 
 * States:
 * - CLOSED: Normal operation. Counts failures. Opens circuit after threshold.
 * - OPEN: All requests fail immediately with circuit open error.
 * - HALF_OPEN: Allows limited requests to test if IdP recovered.
 *   Success → CLOSED (resets failure count)
 *   Failure → OPEN (resets timer)
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenSuccesses: number = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxAttempts: number;
  private readonly name: string;

  /**
   * Create a new CircuitBreaker
   * 
   * @param options Configuration options
   * @param options.failureThreshold - Number of failures before opening circuit (default: 5)
   * @param options.resetTimeoutMs - Time in ms before attempting recovery (default: 30000 = 30s)
   * @param options.halfOpenMaxAttempts - Successful attempts needed to close circuit (default: 3)
   * @param options.name - Name for logging (default: 'idp')
   */
  constructor(options: CircuitBreakerOptions = {}) {
    const {
      failureThreshold = 5,
      resetTimeoutMs = 30000,
      halfOpenMaxAttempts = 3,
      name = 'idp',
    } = options;

    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.halfOpenMaxAttempts = halfOpenMaxAttempts;
    this.name = name;
  }

  /**
   * Check if circuit allows requests
   */
  canExecute(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if reset timeout has passed
        if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
          this.state = CircuitState.HALF_OPEN;
          this.halfOpenSuccesses = 0;
          logger.info(`[SDK_CIRCUIT_BREAKER] [${this.name}] Transitioning to HALF_OPEN after ${this.resetTimeoutMs}ms timeout`);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited requests in half-open state
        return true;

      default:
        return true;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    switch (this.state) {
      case CircuitState.CLOSED:
        // Reset failure count on success
        if (this.failureCount > 0) {
          this.failureCount = 0;
        }
        break;

      case CircuitState.HALF_OPEN:
        this.halfOpenSuccesses++;
        if (this.halfOpenSuccesses >= this.halfOpenMaxAttempts) {
          this.state = CircuitState.CLOSED;
          this.failureCount = 0;
          this.halfOpenSuccesses = 0;
          logger.info(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit CLOSED after ${this.halfOpenSuccesses} successful attempts`);
        }
        break;

      case CircuitState.OPEN:
        // Shouldn't happen, but handle gracefully
        break;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.lastFailureTime = Date.now();

    switch (this.state) {
      case CircuitState.CLOSED:
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
          this.state = CircuitState.OPEN;
          logger.error(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit OPENED after ${this.failureCount} failures`, new Error('Circuit opened'));
        }
        break;

      case CircuitState.HALF_OPEN:
        // Any failure in half-open opens the circuit again
        this.state = CircuitState.OPEN;
        logger.warn(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit OPENED from HALF_OPEN after failure`);
        break;

      case CircuitState.OPEN:
        // Already open, just update last failure time
        break;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Check if circuit is open (failing fast)
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Check if circuit is closed (normal operation)
   */
  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Check if circuit is half-open (testing recovery)
   */
  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }

  /**
   * Get time until next retry attempt (ms)
   */
  getTimeUntilRetry(): number {
    if (this.state !== CircuitState.OPEN) {
      return 0;
    }
    const elapsed = Date.now() - this.lastFailureTime;
    return Math.max(0, this.resetTimeoutMs - elapsed);
  }

  /**
   * Force reset the circuit to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.halfOpenSuccesses = 0;
    this.lastFailureTime = 0;
    logger.info(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit manually reset to CLOSED`);
  }

  /**
   * Force open the circuit
   */
  trip(): void {
    this.state = CircuitState.OPEN;
    this.lastFailureTime = Date.now();
    logger.warn(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit manually tripped to OPEN`);
  }

  /**
   * Get a status object for monitoring
   */
  getStatus(): CircuitBreakerStatus {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      timeUntilRetry: this.getTimeUntilRetry(),
      halfOpenSuccesses: this.halfOpenSuccesses,
      halfOpenMaxAttempts: this.halfOpenMaxAttempts,
    };
  }
}

/**
 * Options for CircuitBreaker constructor
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting recovery (default: 30000 = 30s) */
  resetTimeoutMs?: number;
  /** Successful attempts needed to close circuit from half-open (default: 3) */
  halfOpenMaxAttempts?: number;
  /** Name for logging (default: 'idp') */
  name?: string;
}

/**
 * Circuit breaker status for monitoring
 */
export interface CircuitBreakerStatus {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  timeUntilRetry: number;
  halfOpenSuccesses: number;
  halfOpenMaxAttempts: number;
}

/**
 * Global circuit breaker instance for IdP calls
 * 
 * Configured with safe defaults:
 * - Opens after 5 consecutive failures
 * - Waits 30 seconds before testing recovery
 * - Requires 3 successful requests in half-open to close
 */
export const idpCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 3,
  name: 'idp',
});

/**
 * Create a new circuit breaker with custom options
 */
export function createCircuitBreaker(options: CircuitBreakerOptions = {}): CircuitBreaker {
  return new CircuitBreaker(options);
}