// Types
export * from './types';

// Cryptographic and subdomain helpers
export { verifyToken } from './utils/crypto';
export { getTenantSubdomain } from './utils/subdomain';

// Proxy Guard
export { withIndustrialAuth } from './proxy';

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
