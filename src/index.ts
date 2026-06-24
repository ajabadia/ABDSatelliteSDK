/**
 * @purpose Proporciona funciones y tipos de utilidad para autenticación, gestión de sesiones, limitación de velocidad, operaciones de base de datos, personalización, seguridad y más.
 * @purpose_en Exports various utility functions and types for authentication, session management, rate limiting, database operations, branding, security, and more.
 * @refactorable false
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:8,imports:0,sig:1ky2ri2
 * @lastUpdated 2026-06-23T20:31:07.088Z
 */

// Types
export * from './types';
export type { FetchRetryResult } from './types';

// Cryptographic and subdomain helpers
export { verifyToken, generateToken } from './utils/crypto';
export type { TokenPayloadInput } from './utils/crypto';
export { getTenantSubdomain } from './utils/subdomain';

// Proxy Guard
export { withIndustrialAuth } from './proxy';
export { fetchWithRetry } from './utils/fetch-with-retry';

// Server-side session helpers
export { getIndustrialSession, ensureIndustrialAccess, UnauthorizedAccessError, InsufficientPrivilegesError } from './session';

// Redis session cache (Fase 6.5)
export { getCache, setCache, delCache, sessionCacheKey, verifyCacheKey, hashToken } from './session/redis-store';
export { resolveTargetTenantContext } from './utils/tenant-resolver';

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
export { QuizEventAction, QuizEntityType } from './events';
export type { QuizEventActionType, QuizEntityTypeValue } from './events';

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

export { default as connectDB, connectAuthDB, connectLogsDB, default } from './utils/mongodb';
export { CircuitBreaker, idpCircuitBreaker, createCircuitBreaker, CircuitState } from './utils/circuitBreaker';
export type { CircuitBreakerOptions, CircuitBreakerStatus } from './utils/circuitBreaker';

// Security (AES encryption)
export { SecurityService } from './utils/security';

// Resend Email Service
export { ResendEmailService } from './utils/email';
export type { ResendEmailOptions } from './utils/email';

// Guardian ABAC Evaluation
export { evaluateAccess } from './utils/guardian';
export type { EvaluateAccessParams, EvaluateAccessResult } from './utils/guardian';

