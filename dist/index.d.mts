import { I as IndustrialAuthOptions, U as UserProfile, F as FederatedSession } from './types-CLrrtVBg.mjs';
export { N as NextFetchRequestConfig, a as NextFetchRequestInit, T as TenantBranding, b as TenantBrandingTheme, c as TenantInfo } from './types-CLrrtVBg.mjs';
import { JWTPayload } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
declare function getTenantSubdomain(host: string | null, rootDomain?: string): string | null;

/**
 * 🛰️ Higher-Order Proxy Guard (withIndustrialAuth) for Satellite Applications.
 * Encapsulates tenant resolution, allowedApps licensing validation, cross-tenant security, and loop prevention.
 */
declare function withIndustrialAuth(options: IndustrialAuthOptions): (request: NextRequest) => Promise<NextResponse<unknown>>;

declare class UnauthorizedAccessError extends Error {
    constructor(message?: string);
}
declare class InsufficientPrivilegesError extends Error {
    constructor(message?: string);
}
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

declare const TenantInfoSchema: z.ZodObject<{
    tenantId: z.ZodString;
    active: z.ZodBoolean;
    allowedApps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    branding: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodAny, z.objectOutputType<{
    tenantId: z.ZodString;
    active: z.ZodBoolean;
    allowedApps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    branding: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.ZodAny, "strip">, z.objectInputType<{
    tenantId: z.ZodString;
    active: z.ZodBoolean;
    allowedApps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    branding: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.ZodAny, "strip">>;
declare const FederatedSessionSchema: z.ZodObject<{
    authenticated: z.ZodBoolean;
    user: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        name: z.ZodString;
        surname: z.ZodString;
        role: z.ZodString;
        tenantId: z.ZodString;
        permissions: z.ZodArray<z.ZodString, "many">;
        dbPrefix: z.ZodString;
        isolationStrategy: z.ZodString;
        sessionId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        tenantId: string;
        id: string;
        email: string;
        name: string;
        surname: string;
        role: string;
        permissions: string[];
        dbPrefix: string;
        isolationStrategy: string;
        sessionId?: string | undefined;
    }, {
        tenantId: string;
        id: string;
        email: string;
        name: string;
        surname: string;
        role: string;
        permissions: string[];
        dbPrefix: string;
        isolationStrategy: string;
        sessionId?: string | undefined;
    }>>;
    tenantInfo: z.ZodOptional<z.ZodObject<{
        tenantId: z.ZodString;
        active: z.ZodBoolean;
        allowedApps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        branding: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodAny, z.objectOutputType<{
        tenantId: z.ZodString;
        active: z.ZodBoolean;
        allowedApps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        branding: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, z.ZodAny, "strip">, z.objectInputType<{
        tenantId: z.ZodString;
        active: z.ZodBoolean;
        allowedApps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        branding: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, z.ZodAny, "strip">>>;
}, "strip", z.ZodTypeAny, {
    authenticated: boolean;
    user?: {
        tenantId: string;
        id: string;
        email: string;
        name: string;
        surname: string;
        role: string;
        permissions: string[];
        dbPrefix: string;
        isolationStrategy: string;
        sessionId?: string | undefined;
    } | undefined;
    tenantInfo?: z.objectOutputType<{
        tenantId: z.ZodString;
        active: z.ZodBoolean;
        allowedApps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        branding: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, z.ZodAny, "strip"> | undefined;
}, {
    authenticated: boolean;
    user?: {
        tenantId: string;
        id: string;
        email: string;
        name: string;
        surname: string;
        role: string;
        permissions: string[];
        dbPrefix: string;
        isolationStrategy: string;
        sessionId?: string | undefined;
    } | undefined;
    tenantInfo?: z.objectInputType<{
        tenantId: z.ZodString;
        active: z.ZodBoolean;
        allowedApps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        branding: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, z.ZodAny, "strip"> | undefined;
}>;
declare const SessionVerifySchema: z.ZodObject<{
    active: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    active: boolean;
}, {
    active: boolean;
}>;
declare const TokenResponseSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
declare const VerifiedTokenPayloadSchema: z.ZodObject<{
    sub: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    surname: z.ZodOptional<z.ZodString>;
    role: z.ZodString;
    tenantId: z.ZodString;
    permissions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dbPrefix: z.ZodOptional<z.ZodString>;
    isolationStrategy: z.ZodOptional<z.ZodString>;
    allowedApps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sessionId: z.ZodOptional<z.ZodString>;
    iat: z.ZodOptional<z.ZodNumber>;
    exp: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodAny, z.objectOutputType<{
    sub: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    surname: z.ZodOptional<z.ZodString>;
    role: z.ZodString;
    tenantId: z.ZodString;
    permissions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dbPrefix: z.ZodOptional<z.ZodString>;
    isolationStrategy: z.ZodOptional<z.ZodString>;
    allowedApps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sessionId: z.ZodOptional<z.ZodString>;
    iat: z.ZodOptional<z.ZodNumber>;
    exp: z.ZodOptional<z.ZodNumber>;
}, z.ZodAny, "strip">, z.objectInputType<{
    sub: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    surname: z.ZodOptional<z.ZodString>;
    role: z.ZodString;
    tenantId: z.ZodString;
    permissions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dbPrefix: z.ZodOptional<z.ZodString>;
    isolationStrategy: z.ZodOptional<z.ZodString>;
    allowedApps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sessionId: z.ZodOptional<z.ZodString>;
    iat: z.ZodOptional<z.ZodNumber>;
    exp: z.ZodOptional<z.ZodNumber>;
}, z.ZodAny, "strip">>;

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

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
interface LoggerConfig {
    endpoint?: string;
    token?: string;
    appId?: string;
    minLevel?: LogLevel;
}
interface LogMeta {
    [key: string]: any;
}
interface AuditLogPayload {
    tenantId: string;
    action: string;
    entityType: string;
    entityId: string;
    userId: string;
    userEmail: string;
    changedFields?: Record<string, any>;
    previousState?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    [key: string]: any;
}
/**
 * ⚙️ Configures the global central logger options dynamically.
 */
declare function configureLogger(config: LoggerConfig): void;
/**
 * 🔒 Recursively traverses and redacts PII (Personal Identifiable Information) from variables, objects, and arrays.
 */
declare function redactPII<T>(val: T, keyName?: string): T;
/**
 * 🛰️ Central Structured Logger for the ABD Ecosystem.
 * Guarantees automated PII redaction and fail-safe remote forensic log ingestion.
 */
declare const logger: {
    debug(message: string, meta?: LogMeta): void;
    info(message: string, meta?: LogMeta): void;
    warn(message: string, meta?: LogMeta): void;
    error(message: string, errorOrMessage: any, meta?: LogMeta): void;
    /**
     * 📡 Transmits a forensic audit log recursively redacted of PII (except for root userEmail)
     * to the ABDLogs central microservice in a non-blocking (fire-and-forget) manner.
     */
    audit(payload: AuditLogPayload): void;
};

export { type AuditLogPayload, BrandingStyles, FederatedSession, FederatedSessionSchema, IndustrialAuthOptions, InsufficientPrivilegesError, type LogLevel, type LogMeta, type LoggerConfig, SessionVerifySchema, TenantInfoSchema, TokenResponseSchema, UnauthorizedAccessError, UserProfile, VerifiedTokenPayloadSchema, configureLogger, createAuthRouteHandler, ensureIndustrialAccess, getIndustrialSession, getTenantSubdomain, logger, redactPII, verifyToken, withIndustrialAuth };
