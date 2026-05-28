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

// Logger (enhanced with Offline Buffering)
export { configureLogger, logger, redactPII } from './logger';
export type { LoggerConfig, AuditLogPayload, LogMeta, LogLevel } from './logger';

// QUIZ Ecosystem Event Types
export { QuizEventAction, QuizEntityType } from './types';
export type { QuizEventActionType, QuizEntityTypeValue } from './types';

// Rate Limiter
export { RateLimiter, idpRateLimiter, createRateLimiter } from './utils/rateLimiter';
export type { RateLimiterOptions } from './utils/rateLimiter';

// Multi-Tenant Database Module
export type { TenantContext } from './db/tenant-context';
export { tenantStorage } from './db/tenant-context';
export { resolveTenantUri, getTenantConnection, ensureConnectionReady } from './db/tenant-connection';
export { withTenantContext, getTenantModel, getGlobalModel } from './db/tenant-model';

// Cloudinary Branding Assets
export { uploadBrandingAsset, deleteCloudinaryAsset } from './utils/cloudinary';

// Crypto Chain (forensic audit hashing)
export { computeBlockHash } from './utils/crypto-chain';

// Tenant Branding resolver (RSC-safe)
export { resolveTenantBranding } from './utils/tenant-branding';

export { default as connectDB, connectAuthDB, connectLogsDB, default } from './utils/mongodb';
export { CircuitBreaker, idpCircuitBreaker, createCircuitBreaker, CircuitState } from './utils/circuitBreaker';
export type { CircuitBreakerOptions, CircuitBreakerStatus } from './utils/circuitBreaker';
