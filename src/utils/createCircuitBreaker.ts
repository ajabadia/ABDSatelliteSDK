/**
 * @purpose Proporciona una nueva instancia del CircuitBreaker con las opciones proporcionadas.
 * @purpose_en Creates and returns a new instance of the CircuitBreaker class with the provided options.
 * @refactorable false
 * @classification Helper Utility
 * @complexity Low
 * @fingerprint exports:1,imports:2,sig:1mtsyav
 * @lastUpdated 2026-06-23T20:32:32.066Z
 */

import { CircuitBreaker } from './circuitBreaker';
import type { CircuitBreakerOptions } from './circuitBreakerTypes';

export function createCircuitBreaker(options: CircuitBreakerOptions = {}): CircuitBreaker {
  return new CircuitBreaker(options);
}
