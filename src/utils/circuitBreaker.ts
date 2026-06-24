/**
 * @purpose Gestiona el patrón de interruptor de circuito para llamadas de IdP, evitando fallos cascados mediante fallas rápidas y reiniciándose después de un tiempo de espera.
 * @purpose_en Manages the circuit breaker pattern for IdP calls, preventing cascading failures by failing fast and resetting after a timeout.
 * @refactorable true (contains too many state variables and logic)
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:2,imports:2,sig:dqllca
 * @lastUpdated 2026-06-23T23:25:06.080Z
 */

import { logger } from './logger';
import { CircuitState } from './circuitBreakerTypes';
export { CircuitState, type CircuitBreakerOptions, type CircuitBreakerStatus } from './circuitBreakerTypes';
export { createCircuitBreaker } from './createCircuitBreaker';

/**
 * 🔌 Circuit Breaker for IdP calls.
 * Prevents cascading failures when the IdP is down by failing fast
 * instead of exhausting resources with retries.
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

  constructor(options: { failureThreshold?: number; resetTimeoutMs?: number; halfOpenMaxAttempts?: number; name?: string } = {}) {
    const { failureThreshold = 5, resetTimeoutMs = 30000, halfOpenMaxAttempts = 3, name = 'idp' } = options;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.halfOpenMaxAttempts = halfOpenMaxAttempts;
    this.name = name;
  }

  canExecute(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED: return true;
      case CircuitState.OPEN:
        if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
          this.state = CircuitState.HALF_OPEN;
          this.halfOpenSuccesses = 0;
          logger.info(`[SDK_CIRCUIT_BREAKER] [${this.name}] Transitioning to HALF_OPEN after ${this.resetTimeoutMs}ms timeout`);
          return true;
        }
        return false;
      case CircuitState.HALF_OPEN: return true;
      default: return true;
    }
  }

  recordSuccess(): void {
    switch (this.state) {
      case CircuitState.CLOSED:
        if (this.failureCount > 0) this.failureCount = 0;
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
      case CircuitState.OPEN: break;
    }
  }

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
        this.state = CircuitState.OPEN;
        logger.warn(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit OPENED from HALF_OPEN after failure`);
        break;
      case CircuitState.OPEN: break;
    }
  }

  getState(): CircuitState { return this.state; }
  getFailureCount(): number { return this.failureCount; }
  isOpen(): boolean { return this.state === CircuitState.OPEN; }
  isClosed(): boolean { return this.state === CircuitState.CLOSED; }
  isHalfOpen(): boolean { return this.state === CircuitState.HALF_OPEN; }

  getTimeUntilRetry(): number {
    if (this.state !== CircuitState.OPEN) return 0;
    return Math.max(0, this.resetTimeoutMs - (Date.now() - this.lastFailureTime));
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.halfOpenSuccesses = 0;
    this.lastFailureTime = 0;
    logger.info(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit manually reset to CLOSED`);
  }

  trip(): void {
    this.state = CircuitState.OPEN;
    this.lastFailureTime = Date.now();
    logger.warn(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit manually tripped to OPEN`);
  }

  getStatus() {
    return {
      state: this.state, failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime, timeUntilRetry: this.getTimeUntilRetry(),
      halfOpenSuccesses: this.halfOpenSuccesses, halfOpenMaxAttempts: this.halfOpenMaxAttempts,
    };
  }
}

export const idpCircuitBreaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30000, halfOpenMaxAttempts: 3, name: 'idp' });
