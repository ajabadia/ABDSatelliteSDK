import { b as NextFetchRequestInit, a as FetchRetryResult, I as IndustrialAuthOptions, U as UserProfile, F as FederatedSession } from './types-CwdvEh2z.mjs';
export { N as NextFetchRequestConfig, T as TenantBranding, c as TenantBrandingTheme, d as TenantInfo } from './types-CwdvEh2z.mjs';
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
 * 🔁 Fetch with exponential backoff retry logic.
 * Retries on network errors and 5xx server errors with jitter to prevent thundering herd.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options (supports Next.js fetch options like `next.revalidate`)
 * @param maxAttempts - Maximum number of attempts (default: 4)
 * @param baseDelayMs - Base delay in milliseconds for exponential backoff (default: 100)
 * @param maxDelayMs - Maximum delay cap in milliseconds (default: 5000)
 * @returns Promise resolving to FetchRetryResult with ok, data, status, and error fields
 *
 * @example
 * ```typescript
 * const result = await fetchWithRetry<User>('/api/user', { next: { revalidate: 60 } });
 * if (result.ok && result.data) {
 *   console.log('User:', result.data);
 * }
 * ```
 */
declare function fetchWithRetry<T>(url: string, options?: NextFetchRequestInit, maxAttempts?: number, baseDelayMs?: number, maxDelayMs?: number): Promise<FetchRetryResult<T>>;
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
    name: z.ZodString;
    dbPrefix: z.ZodString;
    isolationStrategy: z.ZodString;
    allowedApps: z.ZodOptional<z.ZodArray<z.ZodString>>;
    branding: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
}, z.core.$catchall<z.ZodAny>>;
declare const FederatedSessionSchema: z.ZodObject<{
    authenticated: z.ZodBoolean;
    user: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        name: z.ZodDefault<z.ZodString>;
        surname: z.ZodDefault<z.ZodString>;
        role: z.ZodString;
        tenantId: z.ZodString;
        permissions: z.ZodDefault<z.ZodArray<z.ZodString>>;
        dbPrefix: z.ZodDefault<z.ZodString>;
        isolationStrategy: z.ZodDefault<z.ZodString>;
        allowedApps: z.ZodOptional<z.ZodArray<z.ZodString>>;
        sessionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    tenantInfo: z.ZodOptional<z.ZodObject<{
        tenantId: z.ZodString;
        active: z.ZodBoolean;
        name: z.ZodString;
        dbPrefix: z.ZodString;
        isolationStrategy: z.ZodString;
        allowedApps: z.ZodOptional<z.ZodArray<z.ZodString>>;
        branding: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
    }, z.core.$catchall<z.ZodAny>>>;
}, z.core.$strip>;
declare const SessionVerifySchema: z.ZodObject<{
    active: z.ZodBoolean;
}, z.core.$strip>;
declare const TokenResponseSchema: z.ZodObject<{
    token: z.ZodString;
}, z.core.$strip>;
declare const VerifiedTokenPayloadSchema: z.ZodObject<{
    sub: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    surname: z.ZodOptional<z.ZodString>;
    role: z.ZodString;
    tenantId: z.ZodString;
    permissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    dbPrefix: z.ZodOptional<z.ZodString>;
    isolationStrategy: z.ZodOptional<z.ZodString>;
    allowedApps: z.ZodOptional<z.ZodArray<z.ZodString>>;
    sessionId: z.ZodOptional<z.ZodString>;
    iat: z.ZodOptional<z.ZodNumber>;
    exp: z.ZodOptional<z.ZodNumber>;
}, z.core.$catchall<z.ZodAny>>;

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
    [key: string]: unknown;
}
interface AuditLogPayload {
    tenantId: string;
    action: string;
    entityType: string;
    entityId: string;
    userId: string;
    userEmail: string;
    changedFields?: Record<string, unknown>;
    previousState?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    [key: string]: unknown;
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
    error(message: string, errorOrMessage: unknown, meta?: LogMeta): void;
    /**
     * 📡 Transmits a forensic audit log recursively redacted of PII (except for root userEmail)
     * to the ABDLogs central microservice in a non-blocking (fire-and-forget) manner.
     */
    audit(payload: AuditLogPayload): void;
};

/**
 * 🚦 Token Bucket Rate Limiter for SDK IdP calls.
 *
 * Prevents overwhelming the IdP with requests by implementing a token bucket
 * algorithm that limits the rate of outgoing requests.
 *
 * Features:
 * - Token bucket algorithm with configurable rate and burst
 * - Per-key rate limiting (e.g., per tenant)
 * - Sliding window tracking for accurate limiting
 * - Non-blocking check - returns false immediately if rate exceeded
 */
declare class RateLimiter {
    private buckets;
    private readonly refillRate;
    private readonly maxTokens;
    private readonly minDelayMs;
    /**
     * Create a new RateLimiter
     *
     * @param options Configuration options
     * @param options.requestsPerSecond - Maximum sustained requests per second (default: 10)
     * @param options.burstSize - Maximum burst of requests allowed (default: 20)
     * @param options.minDelayMs - Minimum delay between requests in ms (default: 50)
     */
    constructor(options?: RateLimiterOptions);
    /**
     * Check if a request can be made for the given key
     *
     * @param key - The key to rate limit (e.g., tenantId, 'global')
     * @returns true if request can proceed, false if rate limited
     */
    tryAcquire(key?: string): boolean;
    /**
     * Wait until a request can be made for the given key
     *
     * @param key - The key to rate limit
     * @param maxWaitMs - Maximum time to wait in milliseconds (default: 5000)
     * @returns Promise that resolves when request can proceed
     * @throws Error if max wait time is exceeded
     */
    waitForToken(key?: string, maxWaitMs?: number): Promise<void>;
    /**
     * Execute a function with rate limiting
     *
     * @param key - The key to rate limit
     * @param fn - The async function to execute
     * @returns The result of the function
     */
    execute<T>(key: string, fn: () => Promise<T>): Promise<T>;
    /**
     * Get current token count for a key (for monitoring/debugging)
     */
    getTokens(key?: string): number;
    /**
     * Reset rate limit for a key
     */
    reset(key?: string): void;
    /**
     * Get the number of keys being tracked
     */
    getTrackedKeysCount(): number;
}
/**
 * Options for RateLimiter constructor
 */
interface RateLimiterOptions {
    /** Maximum sustained requests per second (default: 10) */
    requestsPerSecond?: number;
    /** Maximum burst of requests allowed (default: 20) */
    burstSize?: number;
    /** Minimum delay between requests in ms (default: 50) */
    minDelayMs?: number;
    /** Maximum wait time for waitForToken in ms (default: 5000) */
    maxWaitMs?: number;
}
/**
 * Global rate limiter instance for IdP calls
 * Configured with safe defaults to prevent overwhelming the IdP
 *
 * Can be configured via environment variables:
 * - SDK_RATE_LIMIT_RPS: requests per second (default: 10)
 * - SDK_RATE_LIMIT_BURST: burst size (default: 20)
 * - SDK_RATE_LIMIT_MIN_DELAY: minimum delay in ms (default: 50)
 */
declare const idpRateLimiter: RateLimiter;
/**
 * Create a new rate limiter with custom options
 */
declare function createRateLimiter(options: RateLimiterOptions): RateLimiter;

/**
 * 🔌 Circuit Breaker States
 *
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail fast without calling IdP
 * - HALF_OPEN: Testing if IdP has recovered, limited requests pass through
 */
declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
/**
 * 🔌 Circuit Breaker for IdP calls.
 *
 * Prevents cascading failures when the IdP is down by failing fast
 * instead of exhausting resources with retries.
 *
 * States:
 * - CLOSED: Normal operation. Counts failures. Opens circuit after threshold.
 * - OPEN: All requests fail immediately with circuit open error.
 * - HALF_OPEN: Allows limited requests to test if IdP recovered.
 *   Success → CLOSED (resets failure count)
 *   Failure → OPEN (resets timer)
 */
declare class CircuitBreaker {
    private state;
    private failureCount;
    private lastFailureTime;
    private halfOpenSuccesses;
    private readonly failureThreshold;
    private readonly resetTimeoutMs;
    private readonly halfOpenMaxAttempts;
    private readonly name;
    /**
     * Create a new CircuitBreaker
     *
     * @param options Configuration options
     * @param options.failureThreshold - Number of failures before opening circuit (default: 5)
     * @param options.resetTimeoutMs - Time in ms before attempting recovery (default: 30000 = 30s)
     * @param options.halfOpenMaxAttempts - Successful attempts needed to close circuit (default: 3)
     * @param options.name - Name for logging (default: 'idp')
     */
    constructor(options?: CircuitBreakerOptions);
    /**
     * Check if circuit allows requests
     */
    canExecute(): boolean;
    /**
     * Record a successful request
     */
    recordSuccess(): void;
    /**
     * Record a failed request
     */
    recordFailure(): void;
    /**
     * Get current circuit state
     */
    getState(): CircuitState;
    /**
     * Get failure count
     */
    getFailureCount(): number;
    /**
     * Check if circuit is open (failing fast)
     */
    isOpen(): boolean;
    /**
     * Check if circuit is closed (normal operation)
     */
    isClosed(): boolean;
    /**
     * Check if circuit is half-open (testing recovery)
     */
    isHalfOpen(): boolean;
    /**
     * Get time until next retry attempt (ms)
     */
    getTimeUntilRetry(): number;
    /**
     * Force reset the circuit to closed state
     */
    reset(): void;
    /**
     * Force open the circuit
     */
    trip(): void;
    /**
     * Get a status object for monitoring
     */
    getStatus(): CircuitBreakerStatus;
}
/**
 * Options for CircuitBreaker constructor
 */
interface CircuitBreakerOptions {
    /** Number of failures before opening circuit (default: 5) */
    failureThreshold?: number;
    /** Time in ms before attempting recovery (default: 30000 = 30s) */
    resetTimeoutMs?: number;
    /** Successful attempts needed to close circuit from half-open (default: 3) */
    halfOpenMaxAttempts?: number;
    /** Name for logging (default: 'idp') */
    name?: string;
}
/**
 * Circuit breaker status for monitoring
 */
interface CircuitBreakerStatus {
    state: CircuitState;
    failureCount: number;
    lastFailureTime: number;
    timeUntilRetry: number;
    halfOpenSuccesses: number;
    halfOpenMaxAttempts: number;
}
/**
 * Global circuit breaker instance for IdP calls
 *
 * Configured with safe defaults:
 * - Opens after 5 consecutive failures
 * - Waits 30 seconds before testing recovery
 * - Requires 3 successful requests in half-open to close
 */
declare const idpCircuitBreaker: CircuitBreaker;
/**
 * Create a new circuit breaker with custom options
 */
declare function createCircuitBreaker(options?: CircuitBreakerOptions): CircuitBreaker;

export { type AuditLogPayload, BrandingStyles, CircuitBreaker, type CircuitBreakerOptions, type CircuitBreakerStatus, CircuitState, FederatedSession, FederatedSessionSchema, FetchRetryResult, IndustrialAuthOptions, InsufficientPrivilegesError, type LogLevel, type LogMeta, type LoggerConfig, NextFetchRequestInit, RateLimiter, type RateLimiterOptions, SessionVerifySchema, TenantInfoSchema, TokenResponseSchema, UnauthorizedAccessError, UserProfile, VerifiedTokenPayloadSchema, configureLogger, createAuthRouteHandler, createCircuitBreaker, createRateLimiter, ensureIndustrialAccess, fetchWithRetry, getIndustrialSession, getTenantSubdomain, idpCircuitBreaker, idpRateLimiter, logger, redactPII, verifyToken, withIndustrialAuth };
