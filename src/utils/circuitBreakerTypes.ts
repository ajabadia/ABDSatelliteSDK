/**
 * @purpose Gestiona tipos y interfaces para la funcionalidad del interruptor de circuito.
 * @purpose_en Defines types and interfaces for circuit breaker functionality.
 * @refactorable false
 * @classification Type Definition
 * @complexity Low
 * @fingerprint exports:3,imports:0,sig:p7vsgr
 * @lastUpdated 2026-06-23T20:32:20.544Z
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxAttempts?: number;
  name?: string;
}

export interface CircuitBreakerStatus {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  timeUntilRetry: number;
  halfOpenSuccesses: number;
  halfOpenMaxAttempts: number;
}
