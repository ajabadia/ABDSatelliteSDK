/**
 * @purpose Proporciona funcionalidades de exportación para autenticación, gestión de sesiones, limitación de velocidad, operaciones de base de datos, personalización, seguridad y más.
 * @purpose_en Exports utility functions and types for authentication, session management, rate limiting, database operations, branding, security, and more.
 * @refactorable true (contains too many state variables and UI parts)
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:12,imports:0,sig:158t4l5
 * @lastUpdated 2026-06-26T10:04:10.183Z
 */

// Types
export * from './types';
export type { FetchRetryResult } from './types';

// Cryptographic and subdomain helpers
export { verifyToken, generateToken } from './core/crypto';
export type { TokenPayloadInput } from './core/crypto';
export { getTenantSubdomain } from './core/subdomain';

// Proxy Guard
export { withIndustrialAuth } from './auth-middleware/proxy';
export { fetchWithRetry } from './utils/fetch-with-retry';

// Server-side session helpers
export { getIndustrialSession, ensureIndustrialAccess, UnauthorizedAccessError, InsufficientPrivilegesError } from './auth-middleware/session';

// Redis session cache (Fase 6.5)
export { getCache, setCache, delCache, sessionCacheKey, verifyCacheKey, hashToken } from './auth-middleware/session/redis-store';
export { resolveTargetTenantContext } from './utils/tenant-resolver';

// Schemas
export * from './core/schemas.js';

// SSR Styling Component
export { BrandingStyles } from './styles/index.js';

// API Dynamic Handler
export { createAuthRouteHandler } from './auth-middleware/routeHandler';

// Logger (enhanced with Offline Buffering)
export { configureLogger, logger, redactPII } from './logger';
export type { LoggerConfig, AuditLogPayload, LogMeta, LogLevel } from './logger';

// QUIZ Ecosystem Event Types
export { QuizEventAction, QuizEntityType } from './auth-middleware/events';
export type { QuizEventActionType, QuizEntityTypeValue } from './auth-middleware/events';

// System Event Types (Fase 9.2 — Event Bus)
export { SystemEventType } from './auth-middleware/events';
export type { SystemEventTypeValue } from './auth-middleware/events';

// Event Bus (Fase 9.2)
export { createPublisher, createConsumer } from './event-bus';
export type { EventEnvelope, EventHandler, EventBusConfig } from './event-bus';

// Rate Limiter (in-memory, per-instance)
export { RateLimiter, idpRateLimiter, createRateLimiter } from './utils/rateLimiter';
export type { RateLimiterOptions } from './utils/rateLimiter';

// Rate Limiter (MongoDB-backed, persistent across serverless invocations)
export { rateLimitMongodb } from './utils/rateLimiter-mongodb';

// Multi-Tenant Database Module
export type { TenantContext } from './db/tenant-context';
export { tenantStorage } from './db/tenant-context';
export { resolveTenantUri, getTenantConnection, ensureConnectionReady } from './db/tenant-connection';
export { withTenantContext, getTenantModel, getGlobalModel } from './db/tenant-model';

// Cloudinary Branding Assets
export { uploadBrandingAsset, deleteCloudinaryAsset } from './utils/cloudinary';

// Branding Utils
export { adjustColor, getContrastColor, hexToHslComponents } from './utils/branding/color-utils';
export { generateTenantCss } from './utils/branding/css-generator';

// Crypto Chain (forensic audit hashing)
export { computeBlockHash } from './utils/crypto-chain';

// Tenant Branding resolver (RSC-safe)
export { resolveTenantBranding } from './utils/tenant-branding';

export { default as connectDB, connectAuthDB, connectLogsDB, default } from './db/mongodb';
export { CircuitBreaker, idpCircuitBreaker, createCircuitBreaker, CircuitState } from './utils/circuitBreaker';
export type { CircuitBreakerOptions, CircuitBreakerStatus } from './utils/circuitBreaker';

// Security (AES encryption + Mongoose field-level encryption plugin)
export { SecurityService } from './core/security';
export { encryptionPlugin } from './db/encryption-plugin';

// Resend Email Service
export { ResendEmailService } from './utils/email';
export type { ResendEmailOptions } from './utils/email';

// Guardian ABAC Evaluation
export { evaluateAccess } from './utils/guardian';
export type { EvaluateAccessParams, EvaluateAccessResult } from './utils/guardian';

// Guardian ABAC Middleware (Fase 9.4)
export { withGuardianAccess } from './auth-middleware/guardian-middleware';
export type { GuardianAccessOptions } from './auth-middleware/guardian-middleware';

