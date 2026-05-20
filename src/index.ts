// Types
export * from './types';

// Cryptographic and subdomain helpers
export { verifyToken } from './utils/crypto';
export { getTenantSubdomain } from './utils/subdomain';

// Proxy Guard
export { withIndustrialAuth } from './proxy';

// Server-side session helpers
export { getIndustrialSession, ensureIndustrialAccess } from './session';

// Client-side hooks
export { SessionProvider, useSession } from './client/useSession';

// SSR Styling Component
export { BrandingStyles } from './styles/BrandingStyles';

// API Dynamic Handler
export { createAuthRouteHandler } from './routeHandler';
