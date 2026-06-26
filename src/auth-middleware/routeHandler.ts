/**
 * @purpose Gestiona rutas de autenticación para el ABDSatelliteSDK, incluyendo gestión de sesiones, logout y cambio de tokens.
 * @purpose_en Handles authentication routes for the ABDSatelliteSDK, including session management, logout, and token exchange.
 * @refactorable true (contains multiple distinct functionalities)
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:1,imports:5,sig:1qj7mse
 * @lastUpdated 2026-06-26T10:03:49.615Z
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIndustrialSession } from './session';
import { logger } from '../utils/logger';
import type { IndustrialAuthOptions } from '../types';
import { TokenResponseSchema } from '../core/schemas.js';

/**
 * 🛰️ Factory function that generates a Next.js App Router API Route Handler.
 * Integrates /session, /logout, and /federated/callback routes natively.
 */
export function createAuthRouteHandler(options: IndustrialAuthOptions) {
  const jwtSecret = options.jwtSecret || process.env.AUTH_JWT_SECRET;

  const providerUrl = options.authProviderUrl || process.env.AUTH_PROVIDER_URL || '/auth';
  const clientId = options.clientId;
  const clientSecret = options.clientSecret || process.env.AUTH_CLIENT_SECRET || '';
  const cookieName = options.cookieName || 'abd_session';
  const verifiedCookieName = options.verifiedCookieName || 'abd_session_verified';

  return async function handler(request: NextRequest) {
    if (!jwtSecret) {
      throw new Error('[SDK] AUTH_JWT_SECRET is required. Pass via options.jwtSecret or AUTH_JWT_SECRET env var.');
    }
    const { pathname, searchParams } = new URL(request.url);
    const cookieDomain = process.env.COOKIE_DOMAIN;

    // 1. Session Status Endpoint (/api/auth/session)
    if (pathname.endsWith('/session')) {
      const session = await getIndustrialSession(jwtSecret);
      return NextResponse.json(session);
    }

    // 2. Logout Endpoint (/api/auth/logout)
    if (pathname.endsWith('/logout')) {
      const isSilent = searchParams.get('silent') === 'true';
      const clearCookieConfig: Record<string, unknown> = {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        httpOnly: true,
      };
      if (cookieDomain) clearCookieConfig.domain = cookieDomain;

      if (isSilent) {
        const response = new NextResponse(null, { status: 200 });
        response.cookies.set(cookieName, '', clearCookieConfig);
        response.cookies.set(verifiedCookieName, '', clearCookieConfig);

        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        return response;
      }

      const appUrl = options.baseAppUrl || process.env.NEXT_PUBLIC_APP_URL || `${new URL(request.url).protocol}//${new URL(request.url).host}`;
      const redirectUri = `${appUrl}/logout-success`;
      const providerLogoutUrl = `${providerUrl}/api/auth/logout`;

      const response = NextResponse.redirect(
        new URL(`${providerLogoutUrl}?redirect_uri=${encodeURIComponent(redirectUri)}`)
      );

      response.cookies.set(cookieName, '', clearCookieConfig);
      response.cookies.set(verifiedCookieName, '', clearCookieConfig);

      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      return response;
    }

    // 3. OAuth Callback Endpoint (/api/auth/federated/callback)
    if (pathname.endsWith('/federated/callback')) {
      const code = searchParams.get('code');
      const state = searchParams.get('state') || '/';

      // Standard OAuth2 Authorization Code Exchange
      if (!code || !/^[A-Za-z0-9_-]{10,256}$/.test(code)) {
        return NextResponse.json({ error: 'Invalid or missing authorization code' }, { status: 400 });
      }

      try {
        const tokenUrl = `${providerUrl}/api/auth/federated/token`;
        const currentUrl = new URL(request.url);
        const dynamicRedirectUri = `${currentUrl.protocol}//${currentUrl.host}/api/abd-auth/federated/callback`;

        const res = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: dynamicRedirectUri,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          return NextResponse.json({ error: 'Token exchange failed', detail: errorData }, { status: 401 });
        }

        const rawData = await res.json();
        const data = TokenResponseSchema.parse(rawData);

        const sessionConfig: Record<string, unknown> = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 8, // 8-hour industrial shift
        };
        if (cookieDomain) sessionConfig.domain = cookieDomain;
        const redirectResponse = NextResponse.redirect(new URL(state, request.url));
        redirectResponse.cookies.set(cookieName, data.token, sessionConfig);

        return redirectResponse;
      } catch (err) {
        logger.error('[SDK_CALLBACK_EXCHANGE_ERROR] Token exchange failed', err);
        return NextResponse.json({ error: 'Internal server error during token exchange' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  };
}
