import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withIndustrialAuth } from './auth-middleware/proxy';

// 1. Mock utils
vi.mock('./core/crypto', () => {
  const mockVerifyToken = vi.fn();
  return {
    verifyToken: mockVerifyToken,
    mockVerifyToken,
  };
});

vi.mock('./core/subdomain', () => {
  const mockGetTenantSubdomain = vi.fn();
  return {
    getTenantSubdomain: mockGetTenantSubdomain,
    mockGetTenantSubdomain,
  };
});

// @ts-ignore - mock exports from vi.mock
import { mockVerifyToken } from './core/crypto';
// @ts-ignore - mock exports from vi.mock
import { mockGetTenantSubdomain } from './core/subdomain';

describe('proxy.ts (withIndustrialAuth)', () => {
  const options = {
    appId: 'quiz',
    clientId: 'client-123',
    clientSecret: 'secret-123',
    jwtSecret: 'jwt-123',
    authProviderUrl: 'https://auth.abd.com',
    publicPaths: ['/', '/logout-success', '/public-info'],
  };

  const middleware = withIndustrialAuth(options);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, 'fetch').mockImplementation(() => {
      throw new Error('Fetch not mocked!');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Asset / Internal Bypass', () => {
    it('should bypass internal assets, Next.js internals, and API endpoints', async () => {
      const paths = [
        'http://localhost/_next/static/chunks/main.js',
        'http://localhost/logo.svg',
        'http://localhost/api/health',
        'http://localhost/favicon.ico',
      ];

      for (const p of paths) {
        const req = new NextRequest(p);
        const res = await middleware(req);
        expect(res.status).toBe(200);
        expect(res.headers.get('x-middleware-next')).toBe('1'); // standard Next.js next indicator
      }
    });

    it('should invoke intlMiddleware for asset paths if provided', async () => {
      const mockIntl = vi.fn().mockResolvedValue(new Response('intl-response'));
      const customMiddleware = withIndustrialAuth({ ...options, intlMiddleware: mockIntl });
      const req = new NextRequest('http://localhost/favicon.ico');
      
      const res = await customMiddleware(req);
      
      expect(mockIntl).toHaveBeenCalledWith(req);
      expect(await res.text()).toBe('intl-response');
    });
  });

  describe('Tenant Resolution', () => {
    it('should redirect to logout-success if host subdomain cannot be resolved or is inactive', async () => {
      mockGetTenantSubdomain.mockReturnValue('inactive-tenant');
      
      const mockFetchResponse = new Response(JSON.stringify({
        tenantId: 'inactive-tenant',
        name: 'Inactive',
        active: false, // Inactive!
        dbPrefix: 'inactive',
        isolationStrategy: 'DATABASE_PER_TENANT',
        allowedApps: ['quiz'],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      
      vi.spyOn(global, 'fetch').mockResolvedValue(mockFetchResponse);

      const req = new NextRequest('http://inactive-tenant.localhost/dashboard');
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('Location')).toContain('/logout-success?error=tenant_not_found');
    });
  });

  describe('Public Paths', () => {
    it('should bypass auth check for public paths when unauthenticated', async () => {
      mockGetTenantSubdomain.mockReturnValue('t1');
      
      const mockFetchResponse = new Response(JSON.stringify({
        tenantId: 't1',
        name: 'Tenant 1',
        active: true,
        dbPrefix: 't1',
        isolationStrategy: 'DATABASE_PER_TENANT',
        allowedApps: ['quiz'],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      vi.spyOn(global, 'fetch').mockResolvedValue(mockFetchResponse);

      const req = new NextRequest('http://t1.localhost/public-info');
      const res = await middleware(req);

      expect(res.status).toBe(200);
    });
  });

  describe('Authentication Redirect', () => {
    it('should redirect unauthenticated users to the authorize endpoint and clear session cookies', async () => {
      mockGetTenantSubdomain.mockReturnValue('t1');
      
      const mockFetchResponse = new Response(JSON.stringify({
        tenantId: 't1',
        name: 'Tenant 1',
        active: true,
        dbPrefix: 't1',
        isolationStrategy: 'DATABASE_PER_TENANT',
        allowedApps: ['quiz'],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      vi.spyOn(global, 'fetch').mockResolvedValue(mockFetchResponse);

      const req = new NextRequest('http://t1.localhost/dashboard');
      req.cookies.set('abd_session', ''); // Empty
      const res = await middleware(req);

      expect(res.status).toBe(307);
      const redirectUrl = res.headers.get('Location');
      expect(redirectUrl).toContain('https://auth.abd.com/api/auth/federated/authorize');
      expect(redirectUrl).toContain('client_id=client-123');
      expect(redirectUrl).toContain('tenant=t1');

      // Verify cleared cookies
      const cookiesHeader = res.headers.get('set-cookie');
      expect(cookiesHeader).toContain('abd_session=;');
      expect(cookiesHeader).toContain('abd_session_verified=;');
    });
  });

  describe('Licensing and Cross-Tenant Restrictions', () => {
    beforeEach(() => {
      mockGetTenantSubdomain.mockReturnValue('t1');
      
      // Default mock fetch for tenant resolution
      const mockTenantResponse = new Response(JSON.stringify({
        tenantId: 't1',
        name: 'Tenant 1',
        active: true,
        dbPrefix: 't1',
        isolationStrategy: 'DATABASE_PER_TENANT',
        allowedApps: ['quiz'], // Tenant has 'quiz' app licensed
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      vi.spyOn(global, 'fetch').mockResolvedValue(mockTenantResponse);
    });

    it('should block and redirect if user allowedApps does not contain appId', async () => {
      mockVerifyToken.mockResolvedValue({
        sub: 'u1',
        email: 'u1@t1.com',
        role: 'USER',
        tenantId: 't1',
        allowedApps: ['logs'], // Missing 'quiz'!
      });

      const req = new NextRequest('http://t1.localhost/dashboard');
      req.cookies.set('abd_session', 'token-val');
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('Location')).toContain('error=app_not_allowed');
    });

    it('should allow access if user is SUPER_ADMIN even if app is missing in allowedApps list', async () => {
      mockVerifyToken.mockResolvedValue({
        sub: 'u-super',
        email: 'super@abd.com',
        role: 'SUPER_ADMIN',
        tenantId: 't1',
        allowedApps: [], // Empty
      });

      const req = new NextRequest('http://t1.localhost/dashboard');
      req.cookies.set('abd_session', 'token-val');
      req.cookies.set('abd_session_verified', '1'); // immunity window
      
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('should block and redirect if user tenantId does not match current host tenantId', async () => {
      mockVerifyToken.mockResolvedValue({
        sub: 'u1',
        email: 'u1@t2.com',
        role: 'USER',
        tenantId: 't2', // Mismatched tenantId! Host is 't1'
        allowedApps: ['quiz'],
      });

      const req = new NextRequest('http://t1.localhost/dashboard');
      req.cookies.set('abd_session', 'token-val');
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('Location')).toContain('https://auth.abd.com/api/auth/federated/authorize');
    });
  });

  describe('Session Expiry Desync Check', () => {
    beforeEach(() => {
      mockGetTenantSubdomain.mockReturnValue('t1');
      mockVerifyToken.mockResolvedValue({
        sub: 'u1',
        email: 'u1@t1.com',
        role: 'USER',
        tenantId: 't1',
        allowedApps: ['quiz'],
        iat: Math.floor(Date.now() / 1000) - 3600,
      });
    });

    it('should verify session central expiry if immunity cookie is missing and set cookie on success', async () => {
      // 1st fetch: resolveTenant info. 2nd fetch: verifySessionExpiry
      const mockTenantInfo = {
        tenantId: 't1',
        name: 'Tenant 1',
        active: true,
        dbPrefix: 't1',
        isolationStrategy: 'DATABASE_PER_TENANT',
        allowedApps: ['quiz'],
      };
      
      const mockSessionVerify = { active: true };

      // @ts-ignore - fetch mock typing
const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url: RequestInfo) => {
        if (url.toString().includes('tenant/info')) {
          return new Response(JSON.stringify(mockTenantInfo), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (url.toString().includes('session/verify')) {
          return new Response(JSON.stringify(mockSessionVerify), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('', { status: 404 });
      });

      const req = new NextRequest('http://t1.localhost/dashboard');
      req.cookies.set('abd_session', 'token-val');
      
      const res = await middleware(req);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Verify verified immunity cookie was injected in response
      const cookiesHeader = res.headers.get('set-cookie');
      expect(cookiesHeader).toContain('abd_session_verified=1');
      expect(cookiesHeader).toContain('Max-Age=300');
    });

    it('should bypass Central IdP verification if immunity cookie is present', async () => {
      const mockTenantInfo = {
        tenantId: 't1',
        name: 'Tenant 1',
        active: true,
        dbPrefix: 't1',
        isolationStrategy: 'DATABASE_PER_TENANT',
        allowedApps: ['quiz'],
      };
      
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockTenantInfo), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      const req = new NextRequest('http://t1.localhost/dashboard');
      req.cookies.set('abd_session', 'token-val');
      req.cookies.set('abd_session_verified', '1'); // Immunity is present!
      
      const res = await middleware(req);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Only tenant info resolved
    });
  });
});
