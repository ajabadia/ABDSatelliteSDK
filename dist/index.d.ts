import { I as IndustrialAuthOptions, U as UserProfile, F as FederatedSession } from './types-BnY5DCNp.js';
export { T as TenantBranding, a as TenantBrandingTheme, b as TenantInfo } from './types-BnY5DCNp.js';
import { JWTPayload } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import * as react_jsx_runtime from 'react/jsx-runtime';

interface VerifiedTokenPayload extends JWTPayload {
    sub: string;
    email: string;
    name: string;
    surname: string;
    role: string;
    tenantId: string;
    permissions: string[];
    dbPrefix: string;
    isolationStrategy: string;
    allowedApps?: string[];
    sessionId?: string;
}
/**
 * 🛡️ Verify JWT signature and expiration.
 * Returns the decoded payload or null if invalid/expired.
 */
declare function verifyToken(token: string, customSecret?: string): Promise<VerifiedTokenPayload | null>;

/**
 * 🏢 Helper to extract tenant subdomain from host header.
 * Excludes main Control Plane and localhost domains.
 */
declare function getTenantSubdomain(host: string | null): string | null;

/**
 * 🛰️ Higher-Order Proxy Guard (withIndustrialAuth) for Satellite Applications.
 * Encapsulates tenant resolution, allowedApps licensing validation, cross-tenant security, and loop prevention.
 */
declare function withIndustrialAuth(options: IndustrialAuthOptions): (request: NextRequest) => Promise<NextResponse<unknown>>;

/**
 * 🛰️ Retrieves the current federated session from the abd_session cookie.
 * Decrypts and verifies the JWT.
 */
declare function getIndustrialSession(customSecret?: string): Promise<FederatedSession>;
/**
 * 🛡️ Assertion Helper
 * Throws an error if the user is not authenticated or lacks the required role.
 * Accounts for SUPER_ADMIN role bypass.
 */
declare function ensureIndustrialAccess(requiredRole?: string, customSecret?: string): Promise<UserProfile>;

interface BrandingStylesProps {
    authProviderUrl?: string;
    revalidateSeconds?: number;
}
/**
 * 🎨 React Server Component for Zero-FOUC Tenant Branding Injection.
 * Places a <style> block in the document head with Tailwind CSS v4 compliant variables.
 */
declare function BrandingStyles({ authProviderUrl, revalidateSeconds }: BrandingStylesProps): Promise<react_jsx_runtime.JSX.Element | null>;

/**
 * 🛰️ Factory function that generates a Next.js App Router API Route Handler.
 * Integrates /session, /logout, and /federated/callback routes natively.
 */
declare function createAuthRouteHandler(options: IndustrialAuthOptions): (request: NextRequest) => Promise<NextResponse<unknown>>;

export { BrandingStyles, FederatedSession, IndustrialAuthOptions, UserProfile, createAuthRouteHandler, ensureIndustrialAccess, getIndustrialSession, getTenantSubdomain, verifyToken, withIndustrialAuth };
