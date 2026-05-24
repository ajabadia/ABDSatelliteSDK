import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createAuthRouteHandler } from './routeHandler';

// 1. Mock ./session module
vi.mock('./session', () => {
  return {
    getIndustrialSession: vi.fn(),
  };
});

import { getIndustrialSession } from './session';

describe('routeHandler.ts', () => {
  const options = {
    appId: 'quiz',
    clientId: 'client-123',
    clientSecret: 'secret-123',
    jwtSecret: 'jwt-123',
    authProviderUrl: 'https://auth.abd.com',
  };

  const handler = createAuthRouteHandler(options);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, 'fetch').mockImplementation(() => {
      throw new Error('Fetch not mocked!');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Session Status (/session)', () => {
    it('should return the current session as JSON', async () => {
      const mockSession = { authenticated: true, user: { id: 'u1' } };
      vi.mocked(getIndustrialSession).mockResolvedValue(mockSession as any);

      const req = new NextRequest('http://localhost/api/auth/session');
      const res = await handler(req);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockSession);
      expect(getIndustrialSession).toHaveBeenCalledWith('jwt-123');
    });
  });

  describe('Logout (/logout)', () => {
    it('should perform silent logout clearing cookies and returning 200', async () => {
      const req = new NextRequest('http://localhost/api/auth/logout?silent=true');
      const res = await handler(req);

      expect(res.status).toBe(200);
      
      // Verify cookie clear values
      const cookiesHeader = res.headers.get('set-cookie');
      expect(cookiesHeader).toContain('abd_session=;');
      expect(cookiesHeader).toContain('abd_session_verified=;');
      expect(res.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
    });

    it('should perform redirect logout clearing cookies and redirecting to Central IdP', async () => {
      const req = new NextRequest('http://localhost/api/auth/logout');
      const res = await handler(req);

      expect(res.status).toBe(307);
      
      const redirectUrl = res.headers.get('Location');
      expect(redirectUrl).toContain('https://auth.abd.com/api/auth/logout');
      expect(redirectUrl).toContain('redirect_uri=http%3A%2F%2Flocalhost%2Flogout-success');

      const cookiesHeader = res.headers.get('set-cookie');
      expect(cookiesHeader).toContain('abd_session=;');
      expect(cookiesHeader).toContain('abd_session_verified=;');
    });
  });

  describe('OAuth Callback (/federated/callback)', () => {
    it('should return 400 for missing code', async () => {
      const req = new NextRequest('http://localhost/api/auth/federated/callback');
      const res = await handler(req);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid or missing authorization code' });
    });

    it('should return 400 for malformed code', async () => {
      const req = new NextRequest('http://localhost/api/auth/federated/callback?code=too_short');
      const res = await handler(req);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid or missing authorization code' });
    });

    it('should exchange code for token and redirect on success', async () => {
      const mockTokenResponse = {
        token: 'signed-jwt-token-from-idp',
      };

      const mockResponse = new Response(JSON.stringify(mockTokenResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse);

      const req = new NextRequest('http://localhost/api/auth/federated/callback?code=valid-auth-code-12345678&state=/exams');
      const res = await handler(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('Location')).toBe('http://localhost/exams');

      // Verify cookies are set
      const cookiesHeader = res.headers.get('set-cookie');
      expect(cookiesHeader).toContain('abd_session=signed-jwt-token-from-idp');
      expect(cookiesHeader).toContain('Max-Age=28800'); // 8 hours

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://auth.abd.com/api/auth/federated/token',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            code: 'valid-auth-code-12345678',
            client_id: 'client-123',
            client_secret: 'secret-123',
            redirect_uri: 'http://localhost/api/auth/federated/callback',
          }),
        })
      );
    });

    it('should return 401 when token exchange responds with an error status', async () => {
      const mockErrorResponse = new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
      
      vi.spyOn(global, 'fetch').mockResolvedValue(mockErrorResponse);

      const req = new NextRequest('http://localhost/api/auth/federated/callback?code=valid-auth-code-12345678');
      const res = await handler(req);

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        error: 'Token exchange failed',
        detail: { error: 'invalid_grant' },
      });
    });

    it('should return 500 when fetch throws an error', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network failure'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const req = new NextRequest('http://localhost/api/auth/federated/callback?code=valid-auth-code-12345678');
      const res = await handler(req);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal server error during token exchange' });
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('Fallback', () => {
    it('should return 404 for unknown endpoints', async () => {
      const req = new NextRequest('http://localhost/api/auth/unknown');
      const res = await handler(req);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Route not found' });
    });
  });
});
