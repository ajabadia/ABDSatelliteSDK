import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './utils/crypto';
import { getTenantSubdomain } from './utils/subdomain';
import { logger } from './utils/logger';
import type { IndustrialAuthOptions, TenantInfo, NextFetchRequestInit } from './types';
import { TenantInfoSchema, SessionVerifySchema } from './utils/schemas.js';

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
export async function fetchWithRetry<T>(
  url: string,
  options: NextFetchRequestInit,
  maxAttempts: number = 4,
  baseDelayMs: number = 100,
  maxDelayMs: number = 5000
): Promise<FetchRetryResult<T>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);

      // Don't retry 4xx errors (client errors) - they won't succeed on retry
      if (!res.ok && res.status >= 500) {
        lastError = new Error(`Server error: ${res.status}`);
        if (attempt < maxAttempts - 1) {
          // Exponential backoff with jitter: delay = baseDelay * 2^attempt + random(0, baseDelay/2)
          const backoffDelay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
          const jitter = Math.random() * baseDelayMs * 0.5;
          const delay = Math.floor(backoffDelay + jitter);
          logger.warn(`[SDK_RETRY] Attempt ${attempt + 1} failed with ${res.status}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        // Last attempt failed - log before returning
        logger.error(`[SDK_RETRY] Final attempt (${attempt + 1}/${maxAttempts}) failed with ${res.status}:`, lastError);
        return { ok: false, status: res.status, error: lastError.message };
      }

      // For 2xx or 4xx, return as-is (4xx are handled by caller)
      const data = res.ok ? await res.json().catch(() => null) : null;
      return { ok: res.ok, data, status: res.status };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts - 1) {
        const backoffDelay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = Math.random() * baseDelayMs * 0.5;
        const delay = Math.floor(backoffDelay + jitter);
        logger.warn(`[SDK_RETRY] Attempt ${attempt + 1} failed with error: ${lastError.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(`[SDK_RETRY] All ${maxAttempts} attempts failed. Last error:`, lastError);
  return { ok: false, error: lastError?.message };
}

/**
 * 🏢 Fetch tenant info from the Central Identity Provider.
 */
async function resolveTenant(subdomain: string, providerUrl: string): Promise<TenantInfo | null> {
  try {
    const url = `${providerUrl}/api/auth/tenant/info?subdomain=${subdomain}`;
    const result = await fetchWithRetry<TenantInfo>(url, {
      next: { revalidate: 60 }
    } as NextFetchRequestInit, 3, 100);

    if (result.ok && result.data) {
      return TenantInfoSchema.parse(result.data) as TenantInfo;
    }
  } catch (err) {
    logger.error('[SDK_TENANT_RESOLVE_ERROR] Failed to resolve tenant', err);
  }
  return null;
}

const debugLog = (msg: string, meta?: Record<string, unknown>) => {
  if (process.env.NODE_ENV !== 'production') {
    logger.debug(msg, meta);
  }
};

/**
 * 🛡️ Session Expiry Desync Check.
 */
async function verifySessionExpiry(
  email: string,
  sessionId: string,
  tokenIat: number,
  requestUrl: string,
  providerUrl: string,
  clientSecret: string
): Promise<boolean> {
  try {
    const verifyUrl = new URL(`${providerUrl}/api/auth/session/verify`, requestUrl);
    verifyUrl.searchParams.set('email', email);
    if (sessionId) {
      verifyUrl.searchParams.set('sessionId', sessionId);
    }

    const result = await fetchWithRetry<{ active: boolean }>(verifyUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${clientSecret}`,
        'Content-Type': 'application/json'
      },
      next: { revalidate: 0 }
    } as NextFetchRequestInit, 3, 100);

    if (result.ok && result.data) {
      const parsed = SessionVerifySchema.parse(result.data);
      return parsed.active;
    } else {
      const isWithin24h = (Date.now() / 1000) - tokenIat < 86400;
      const status = result.status || 0;
      logger.warn(`[SDK_SESSION_VERIFY_WARNING] Central IdP returned status ${status}. Fallback (24h rule): ${isWithin24h}`);
      return isWithin24h;
    }
  } catch (err) {
    const isWithin24h = (Date.now() / 1000) - tokenIat < 86400;
    logger.error('[SDK_SESSION_VERIFY_ERROR] Failed to contact Central IdP. Fallback (24h rule):', err);
    return isWithin24h;
  }
}

/**
 * 🛰️ Higher-Order Proxy Guard (withIndustrialAuth) for Satellite Applications.
 * Encapsulates tenant resolution, allowedApps licensing validation, cross-tenant security, and loop prevention.
 */
export function withIndustrialAuth(options: IndustrialAuthOptions) {
  const providerUrl = options.authProviderUrl || process.env.AUTH_PROVIDER_URL || 'https://abd-auth.vercel.app';
  const clientSecret = options.clientSecret || process.env.AUTH_CLIENT_SECRET || '';
  const jwtSecret = options.jwtSecret || process.env.AUTH_JWT_SECRET || '';
  const cookieName = options.cookieName || 'abd_session';
  const verifiedCookieName = options.verifiedCookieName || 'abd_session_verified';
  const publicPaths = options.publicPaths || ['/', '/logout-success'];

  return async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Skip auth for assets, Next.js internals, and API endpoints
    const isAsset =
      pathname.includes('.') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/') ||
      pathname === '/favicon.ico';

    if (isAsset) {
      return options.intlMiddleware ? options.intlMiddleware(request) : NextResponse.next();
    }

    // Request intercepted

    // 2. Resolve Tenant from Subdomain
    const host = request.headers.get('host');
    const subdomain = getTenantSubdomain(host);
    let tenantInfo: TenantInfo | null = null;

    if (subdomain) {
      tenantInfo = await resolveTenant(subdomain, providerUrl);

      // Redirect if tenant is inactive
      if (!tenantInfo || !tenantInfo.active) {
        const baseAppUrl = options.baseAppUrl || process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
        debugLog(`[SDK_PROXY] [${options.appId}] Tenant inactive or not found: ${subdomain}`);
        return NextResponse.redirect(new URL(`${baseAppUrl}/logout-success?error=tenant_not_found`));
      }
    }

    // 3. Match Public Paths (accounting for next-intl locale prefixes)
    const getUnlocalizedPath = (path: string): string => {
      const parts = path.split('/');
      if (parts.length > 1 && parts[1].length === 2) {
        return '/' + parts.slice(2).join('/');
      }
      return path;
    };

    const unlocalizedPath = getUnlocalizedPath(pathname);
    const isPublic = publicPaths.some(p => {
      const normalizedPath = unlocalizedPath.replace(/\/$/, '') || '/';
      const normalizedParam = p.replace(/\/$/, '') || '/';

      if (normalizedParam === '/') {
        return normalizedPath === '/';
      }

      return normalizedPath === normalizedParam || normalizedPath.startsWith(normalizedParam + '/');
    });

    // 4. Validate session JWT
    const sessionCookie = request.cookies.get(cookieName);
    debugLog(`[SDK_PROXY] [${options.appId}] Session cookie '${cookieName}': ${sessionCookie?.value ? 'PRESENT' : 'MISSING'}`);
    let isAuthenticated = false;
    let isAppNotAllowed = false;
    let didVerifyThisRequest = false;
    let userEmail = '';
    let userRole = '';
    let userTenantId = '';
    let userSessionId = '';
    let userTokenIat = 0;

    if (sessionCookie?.value) {
      debugLog(`[SDK_PROXY] [${options.appId}] Verifying token using secret prefix: ${jwtSecret ? jwtSecret.substring(0, 10) + '...' : 'undefined'}`);
      const payload = await verifyToken(sessionCookie.value, jwtSecret);
      if (payload) {
        debugLog(`[SDK_PROXY] [${options.appId}] Token verified for tenant: ${payload.tenantId}`);
        isAuthenticated = true;
        userEmail = payload.email;
        userRole = payload.role;
        userTenantId = payload.tenantId;
        userSessionId = payload.sessionId || '';
        userTokenIat = payload.iat || Math.floor(Date.now() / 1000);

        // Verify if user is licensed for this application
        if (payload.allowedApps && userRole !== 'SUPER_ADMIN') {
          if (!payload.allowedApps.includes(options.appId)) {
            debugLog(`[SDK_AUTH_BLOCKED] User allowedApps does not include '${options.appId}'`);
            isAuthenticated = false;
            isAppNotAllowed = true;
          }
        }
      } else {
        debugLog(`[SDK_PROXY] [${options.appId}] Token verification failed (returned null)`);
      }
    }

    // 5. Cross-Tenant Security Check
    if (isAuthenticated && tenantInfo && userTenantId !== tenantInfo.tenantId) {
      debugLog(`[SDK_CROSS_TENANT_SECURITY_BLOCKED] User tenant '${userTenantId}' does not match host tenant '${tenantInfo.tenantId}'`);
      isAuthenticated = false;
    }

    // 6. Tenant-level allowedApps Licensing Check
    if (isAuthenticated && tenantInfo && tenantInfo.allowedApps && userRole !== 'SUPER_ADMIN') {
      if (!tenantInfo.allowedApps.includes(options.appId)) {
        debugLog(`[SDK_TENANT_BLOCKED] Tenant '${tenantInfo.tenantId}' allowedApps does not include '${options.appId}'`);
        isAuthenticated = false;
        isAppNotAllowed = true;
      }
    }

    // 7. Session Expiry Desync Check
    if (isAuthenticated && sessionCookie && userEmail) {
      const verifiedCookie = request.cookies.get(verifiedCookieName);
      debugLog(`[SDK_PROXY] [${options.appId}] Verified cookie '${verifiedCookieName}': ${verifiedCookie?.value ? 'PRESENT' : 'MISSING'}`);

      if (!verifiedCookie) {
        debugLog(`[SDK_PROXY] [${options.appId}] Contacting IdP to verify session expiry.`);
        const isSessionActive = await verifySessionExpiry(userEmail, userSessionId, userTokenIat, request.url, providerUrl, clientSecret);
        debugLog(`[SDK_PROXY] [${options.appId}] Central session active: ${isSessionActive}`);
        if (isSessionActive) {
          didVerifyThisRequest = true;
        } else {
          debugLog(`[SDK_SESSION_EXPIRED] User session is inactive at central IdP`);
          isAuthenticated = false;
        }
      }
    }

    // 8. Bypass for public paths when not authenticated
    if (isPublic && !isAuthenticated) {
      debugLog(`[SDK_PROXY] [${options.appId}] Unauthenticated request to public path '${pathname}'. Bypassing.`);
      return options.intlMiddleware ? options.intlMiddleware(request) : NextResponse.next();
    }

    // 9. Unauthorized Redirect (Authorize SSO Handshake)
    if (!isAuthenticated) {
      const currentUrl = new URL(request.url);
      const dynamicAppUrl = `${currentUrl.protocol}//${currentUrl.host}`;
      const authorizeUrl = new URL(`${providerUrl}/api/auth/federated/authorize`, request.url);

      authorizeUrl.searchParams.set('client_id', options.clientId);
      authorizeUrl.searchParams.set('redirect_uri', `${dynamicAppUrl}/api/auth/federated/callback`);
      authorizeUrl.searchParams.set('state', pathname);

      if (isAppNotAllowed) {
        authorizeUrl.searchParams.set('error', 'app_not_allowed');
      }

      if (tenantInfo) {
        authorizeUrl.searchParams.set('tenant', tenantInfo.tenantId);
      }

      debugLog(`[SDK_PROXY] [${options.appId}] Redirecting unauthorized user to IdP.`);
      const response = NextResponse.redirect(authorizeUrl);

      // Clean up local cookies to break redirection loops
      response.cookies.set(cookieName, '', { path: '/', maxAge: 0, expires: new Date(0) });
      response.cookies.set(verifiedCookieName, '', { path: '/', maxAge: 0, expires: new Date(0) });

      return response;
    }

    // 10. Pass to internal route / custom middleware
    const response = options.intlMiddleware ? await options.intlMiddleware(request) : NextResponse.next();

    // Set 60-second immunity window cookie if verification succeeded
    if (didVerifyThisRequest) {
      response.cookies.set(verifiedCookieName, '1', {
        path: '/',
        maxAge: 60,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    }

    return response;
  };
}
