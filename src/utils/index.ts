/**
 * @purpose Proporciona funciones y tipos útiles para operaciones comunes como recuperar datos con intentos, limitación de velocidad, fallas circuiticas, subir activos, enviar correos electrónicos, evaluar acceso, resolver contextos de inquilinos, calcular hashes, ajustar colores, generar CSS y configurar registro.
 * @purpose_en Exports various utility functions and types for common operations such as fetching data with retries, rate limiting, circuit breaking, uploading assets, sending emails, evaluating access, resolving tenant contexts, computing hashes, adjusting colors, generating CSS, and configuring logging.
 * @refactorable false
 * @classification Helper Utility
 * @complexity Medium
 * @fingerprint exports:6,imports:0,sig:vd86a0
 * @lastUpdated 2026-06-25T09:22:26.950Z
 */

export { fetchWithRetry } from './fetch-with-retry';
export type { FetchRetryResult } from '../types';
export { RateLimiter, idpRateLimiter, createRateLimiter } from './rateLimiter';
export type { RateLimiterOptions } from './rateLimiter';
export { rateLimitMongodb } from './rateLimiter-mongodb';
export { CircuitBreaker, idpCircuitBreaker, createCircuitBreaker, CircuitState } from './circuitBreaker';
export type { CircuitBreakerOptions, CircuitBreakerStatus } from './circuitBreaker';
export { uploadBrandingAsset, deleteCloudinaryAsset } from './cloudinary';
export { ResendEmailService } from './email';
export type { ResendEmailOptions } from './email';
export { evaluateAccess } from './guardian';
export type { EvaluateAccessParams, EvaluateAccessResult } from './guardian';
export { resolveTargetTenantContext } from './tenant-resolver';
export { resolveTenantBranding } from './tenant-branding';
export { computeBlockHash } from './crypto-chain';
export { adjustColor, getContrastColor, hexToHslComponents } from './branding/color-utils';
export { generateTenantCss } from './branding/css-generator';
// Backward-compat shim — logger canónico ahora vive en ../logger
export { configureLogger, logger, redactPII } from './logger';
export type { LoggerConfig, AuditLogPayload, LogMeta, LogLevel } from './logger';
