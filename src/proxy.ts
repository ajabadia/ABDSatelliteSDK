import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './utils/crypto';
import { getTenantSubdomain } from './utils/subdomain';
import type { IndustrialAuthOptions, TenantInfo } from './types';

/**
 * 🏢 Fetch tenant info from the Central Identity Provider.
 */
async function resolveTenant(subdomain: string, providerUrl: string): Promise<TenantInfo | null> {
  try {
    const url = `${providerUrl}/api/auth/tenant/info?subdomain=${subdomain}`;
    const res = await fetch(url, {
      next: { revalidate: 60 }
    } as RequestInit & { next?: { revalidate: number } });

    if (res.ok) {
      return await res.json() as TenantInfo;
    }
  } catch (err) {
    console.error('[SDK_TENANT_RESOLVE_ERROR]', err);
  }
  return null;
}

/**
 * 🛡️ Session Expiry Desync Check.
 */
async function verifySessionExpiry(
  email: string,
  requestUrl: string,
  providerUrl: string,
  clientSecret: string
): Promise<boolean> {
  try {
    const verifyUrl = new URL(`${providerUrl}/api/auth/session/verify`, requestUrl);
    verifyUrl.searchParams.set('email', email);

    const response = await fetch(verifyUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${clientSecret}`,
        'Content-Type': 'application/json'
      },
      next: { revalidate: 0 }
    } as RequestInit & { next?: { revalidate: number } });

    if (response.ok) {
      const data = await response.json() as { active: boolean };
      return !!data.active;
    } else {
      console.warn(`[SDK_SESSION_VERIFY_WARNING] Central IdP returned status ${response.status}. Falling back to local session.`);
      return true;
    }
  } catch (err) {
    console.error('[SDK_SESSION_VERIFY_ERROR] Failed to contact Central IdP. Falling back to local session.', err);
    return true; // Fail-open resilience
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

    // 2. Resolve Tenant from Subdomain
    const host = request.headers.get('host');
    const subdomain = getTenantSubdomain(host);
    let tenantInfo: TenantInfo | null = null;

    if (subdomain) {
      tenantInfo = await resolveTenant(subdomain, providerUrl);

      // Redirect if tenant is inactive
      if (!tenantInfo || !tenantInfo.active) {
        const baseAppUrl = options.baseAppUrl || process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
        return NextResponse.redirect(new URL(`${baseAppUrl}/logout-success?error=tenant_not_found`));
      }
    }

    // 3. Match Public Paths
    const isPublic = publicPaths.some(p => {
      const normalizedPath = pathname.replace(/\/$/, '');
      const normalizedParam = p.replace(/\/$/, '');
      return normalizedPath === normalizedParam || pathname.startsWith(p + '/');
    });

    // 4. Validate session JWT
    const sessionCookie = request.cookies.get(cookieName);
    let isAuthenticated = false;
    let isAppNotAllowed = false;
    let didVerifyThisRequest = false;
    let userEmail = '';
    let userRole = '';
    let userTenantId = '';

    if (sessionCookie?.value) {
      const payload = await verifyToken(sessionCookie.value, jwtSecret);
      if (payload) {
        isAuthenticated = true;
        userEmail = payload.email;
        userRole = payload.role;
        userTenantId = payload.tenantId;

        // Verify if user is licensed for this application
        if (payload.allowedApps && userRole !== 'SUPER_ADMIN') {
          if (!payload.allowedApps.includes(options.appId)) {
            console.warn(`[SDK_AUTH_BLOCKED] User allowedApps does not include '${options.appId}'`);
            isAuthenticated = false;
            isAppNotAllowed = true;
          }
        }
      }
    }

    // 5. Cross-Tenant Security Check
    if (isAuthenticated && tenantInfo && userTenantId !== tenantInfo.tenantId) {
      console.warn(`[SDK_CROSS_TENANT_SECURITY_BLOCKED] User tenant '${userTenantId}' does not match host tenant '${tenantInfo.tenantId}'`);
      isAuthenticated = false;
    }

    // 6. Tenant-level allowedApps Licensing Check
    if (isAuthenticated && tenantInfo && tenantInfo.allowedApps && userRole !== 'SUPER_ADMIN') {
      if (!tenantInfo.allowedApps.includes(options.appId)) {
        console.warn(`[SDK_TENANT_BLOCKED] Tenant '${tenantInfo.tenantId}' allowedApps does not include '${options.appId}'`);
        isAuthenticated = false;
        isAppNotAllowed = true;
      }
    }

    // 7. Session Expiry Desync Check
    if (isAuthenticated && sessionCookie && userEmail) {
      const verifiedCookie = request.cookies.get(verifiedCookieName);

      if (!verifiedCookie) {
        const isSessionActive = await verifySessionExpiry(userEmail, request.url, providerUrl, clientSecret);
        if (isSessionActive) {
          didVerifyThisRequest = true;
        } else {
          console.warn(`[SDK_SESSION_EXPIRED] User session is inactive at central IdP`);
          isAuthenticated = false;
        }
      }
    }

    // 8. Bypass for public paths when not authenticated
    if (isPublic && !isAuthenticated) {
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
