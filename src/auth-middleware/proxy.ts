/**
 * @purpose Gestiona middleware de autenticación y autorización para ABDSatelliteSDK, maneja sesiones de usuario y redirige a un proveedor de autenticación.
 * @purpose_en Manages authentication and authorization middleware for the ABDSatelliteSDK, handling user sessions and redirecting to an authentication provider.
 * @refactorable true (contains too many state variables and UI parts)
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:2,imports:7,sig:1jd3dfs
 * @lastUpdated 2026-06-26T10:03:46.872Z
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '../core/crypto';
import { getTenantSubdomain } from '../core/subdomain';
import { logger } from '../utils/logger';
import type { IndustrialAuthOptions, TenantInfo } from '../types';
import { fetchWithRetry } from '../utils/fetch-with-retry';
export type { NextFetchRequestInit, FetchRetryResult } from '../types';
import { resolveTenant, verifySessionExpiry } from '../utils/idp-resolver';

const debugLog = (msg: string, meta?: Record<string, unknown>) => { if (process.env.NODE_ENV !== 'production') logger.debug(msg, meta); };

export function withIndustrialAuth(options: IndustrialAuthOptions) {
  const providerUrl = options.authProviderUrl || process.env.AUTH_PROVIDER_URL || '/auth';
  const clientSecret = options.clientSecret || process.env.AUTH_CLIENT_SECRET || '';
  const jwtSecret = options.jwtSecret || process.env.AUTH_JWT_SECRET;
  if (!jwtSecret) throw new Error('[SDK] AUTH_JWT_SECRET is required for JWT verification.');
  const cookieName = options.cookieName || 'abd_session';
  const verifiedCookieName = options.verifiedCookieName || 'abd_session_verified';
  const verifiedCookieMaxAge = options.verifiedCookieMaxAge ?? 300;
  const publicPaths = options.publicPaths || ['/', '/logout-success'];

  return async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    if (pathname.includes('.') || pathname.startsWith('/_next') || pathname.startsWith('/api/') || pathname === '/favicon.ico')
      return options.intlMiddleware ? options.intlMiddleware(request) : NextResponse.next();

    const cookieDomain = process.env.COOKIE_DOMAIN;
    const host = request.headers.get('host');
    const subdomain = getTenantSubdomain(host);
    let tenantInfo: TenantInfo | null = null;

    if (subdomain) {
      tenantInfo = await resolveTenant(subdomain, providerUrl);
      if (!tenantInfo || !tenantInfo.active) {
        const baseAppUrl = options.baseAppUrl || process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
        debugLog(`[SDK_PROXY] [${options.appId}] Tenant not found: ${subdomain}`);
        return NextResponse.redirect(new URL(`${baseAppUrl}/logout-success?error=tenant_not_found`));
      }
    }

    const getUnlocalizedPath = (path: string): string => { const parts = path.split('/'); return (parts.length > 1 && parts[1].length === 2) ? '/' + parts.slice(2).join('/') : path; };
    const unlocalizedPath = getUnlocalizedPath(pathname);
    const isPublic = publicPaths.some(p => {
      const normalizedPath = unlocalizedPath.replace(/\/$/, '') || '/';
      const normalizedParam = p.replace(/\/$/, '') || '/';
      if (normalizedParam === '/') return normalizedPath === '/';
      return normalizedPath === normalizedParam || normalizedPath.startsWith(normalizedParam + '/');
    });

    const sessionCookie = request.cookies.get(cookieName);
    debugLog(`[SDK_PROXY] [${options.appId}] Session cookie: ${sessionCookie?.value ? 'PRESENT' : 'MISSING'}`);
    let isAuthenticated = false, isAppNotAllowed = false, didVerifyThisRequest = false;
    let userEmail = '', userRole = '', userTenantId = '', userSessionId = '';
    let userTokenIat = 0;

    if (sessionCookie?.value) {
      const payload = await verifyToken(sessionCookie.value, jwtSecret);
      if (payload) {
        isAuthenticated = true;
        userEmail = payload.email; userRole = payload.role; userTenantId = payload.tenantId;
        userSessionId = payload.sessionId || '';
        userTokenIat = payload.iat || Math.floor(Date.now() / 1000);
        if (payload.allowedApps && userRole !== 'SUPER_ADMIN' && !payload.allowedApps.includes(options.appId)) {
          isAuthenticated = false; isAppNotAllowed = true;
        }
      }
    }

    if (isAuthenticated && tenantInfo && userTenantId !== tenantInfo.tenantId) isAuthenticated = false;
    if (isAuthenticated && tenantInfo && tenantInfo.allowedApps && userRole !== 'SUPER_ADMIN' && !tenantInfo.allowedApps.includes(options.appId)) { isAuthenticated = false; isAppNotAllowed = true; }
    if (isAuthenticated && sessionCookie && userEmail && !request.cookies.get(verifiedCookieName)) {
      const isSessionActive = await verifySessionExpiry(userEmail, userSessionId, userTokenIat, request.url, providerUrl, clientSecret);
      if (isSessionActive) didVerifyThisRequest = true; else isAuthenticated = false;
    }

    if (isPublic && !isAuthenticated) return options.intlMiddleware ? options.intlMiddleware(request) : NextResponse.next();
    if (!isAuthenticated) {
      const currentUrl = new URL(request.url);
      const authorizeUrl = new URL(`${providerUrl}/api/auth/federated/authorize`, request.url);
      authorizeUrl.searchParams.set('client_id', options.clientId);
      authorizeUrl.searchParams.set('redirect_uri', `${currentUrl.protocol}//${currentUrl.host}/api/abd-auth/federated/callback`);
      authorizeUrl.searchParams.set('state', pathname);
      if (isAppNotAllowed) authorizeUrl.searchParams.set('error', 'app_not_allowed');
      if (tenantInfo) authorizeUrl.searchParams.set('tenant', tenantInfo.tenantId);
      const clearConfig: Record<string, unknown> = { path: '/', maxAge: 0, expires: new Date(0) };
      if (cookieDomain) clearConfig.domain = cookieDomain;
      const response = NextResponse.redirect(authorizeUrl);
      response.cookies.set(cookieName, '', clearConfig);
      response.cookies.set(verifiedCookieName, '', clearConfig);
      return response;
    }

    const response = options.intlMiddleware ? await options.intlMiddleware(request) : NextResponse.next();
    if (didVerifyThisRequest) {
      const verifiedConfig: Record<string, unknown> = { path: '/', maxAge: verifiedCookieMaxAge, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' };
      if (cookieDomain) verifiedConfig.domain = cookieDomain;
      response.cookies.set(verifiedCookieName, '1', verifiedConfig);
    }
    return response;
  };
}
