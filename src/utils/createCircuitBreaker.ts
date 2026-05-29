import { CircuitBreaker } from './circuitBreaker';
import type { CircuitBreakerOptions } from './circuitBreakerTypes';

export function createCircuitBreaker(options: CircuitBreakerOptions = {}): CircuitBreaker {
  return new CircuitBreaker(options);
}
