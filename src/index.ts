// Types
export * from './types';
export type { FetchRetryResult } from './types';

// Cryptographic and subdomain helpers
export { verifyToken } from './utils/crypto';
export { getTenantSubdomain } from './utils/subdomain';

// Proxy Guard
export { withIndustrialAuth, fetchWithRetry } from './proxy';

// Server-side session helpers
export { getIndustrialSession, ensureIndustrialAccess, UnauthorizedAccessError, InsufficientPrivilegesError } from './session';

// Schemas
export * from './utils/schemas.js';

// SSR Styling Component
export { BrandingStyles } from './styles/BrandingStyles';

// API Dynamic Handler
export { createAuthRouteHandler } from './routeHandler';

// Logger
export { configureLogger, logger, redactPII } from './utils/logger';
export type { LoggerConfig, AuditLogPayload, LogMeta, LogLevel } from './utils/logger';

// Rate Limiter
export { RateLimiter, idpRateLimiter, createRateLimiter } from './utils/rateLimiter';
export type { RateLimiterOptions } from './utils/rateLimiter';

// Circuit Breaker
export { CircuitBreaker, idpCircuitBreaker, createCircuitBreaker, CircuitState } from './utils/circuitBreaker';
export type { CircuitBreakerOptions, CircuitBreakerStatus } from './utils/circuitBreaker';
