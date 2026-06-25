import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getIndustrialSession, ensureIndustrialAccess, UnauthorizedAccessError, InsufficientPrivilegesError } from './auth-middleware/session';

// 1. Mock next/headers
vi.mock('next/headers', () => {
  const mockGet = vi.fn();
  const mockCookies = vi.fn().mockResolvedValue({
    get: mockGet,
  });
  return {
    cookies: mockCookies,
    mockGet,
    mockCookies,
  };
});

// 2. Mock ./core/crypto
vi.mock('./core/crypto', () => {
  const mockVerifyToken = vi.fn();
  return {
    verifyToken: mockVerifyToken,
    mockVerifyToken,
  };
});

// @ts-ignore - mock exports from vi.mock
import { mockGet, mockCookies } from 'next/headers';
// @ts-ignore - mock exports from vi.mock
import { mockVerifyToken } from './core/crypto';

describe('session.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getIndustrialSession', () => {
    it('should return authenticated: false if the abd_session cookie is missing', async () => {
      mockGet.mockReturnValue(undefined);

      const session = await getIndustrialSession();

      expect(mockCookies).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalledWith('abd_session');
      expect(session).toEqual({ authenticated: false });
    });

    it('should return authenticated: false if verification fails', async () => {
      mockGet.mockReturnValue({ value: 'invalid-token' });
      mockVerifyToken.mockResolvedValue(null);

      const session = await getIndustrialSession('custom-secret');

      expect(mockVerifyToken).toHaveBeenCalledWith('invalid-token', 'custom-secret');
      expect(session).toEqual({ authenticated: false });
    });

    it('should return authenticated session and user profile when token is valid', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@abd.com',
        name: 'John',
        surname: 'Doe',
        role: 'ADMIN',
        tenantId: 'tenant-abc',
        dbPrefix: 't_abc',
        isolationStrategy: 'DATABASE_PER_TENANT',
        permissions: ['READ_LOGS'],
        allowedApps: ['quiz', 'logs'],
      };

      mockGet.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(mockPayload);

      const session = await getIndustrialSession();

      expect(session).toEqual({
        authenticated: true,
        user: {
          id: 'user-123',
          email: 'test@abd.com',
          name: 'John',
          surname: 'Doe',
          role: 'ADMIN',
          tenantId: 'tenant-abc',
          dbPrefix: 't_abc',
          isolationStrategy: 'DATABASE_PER_TENANT',
          permissions: ['READ_LOGS'],
          allowedApps: ['quiz', 'logs'],
        },
      });
    });

    it('should handle optional / missing claims with schema defaults', async () => {
      const mockMinimalPayload = {
        sub: 'user-123',
        email: 'test@abd.com',
        role: 'USER',
        tenantId: 'tenant-abc',
      };

      mockGet.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(mockMinimalPayload);

      const session = await getIndustrialSession();

      expect(session.user).toEqual(
        expect.objectContaining({
          permissions: [],
        })
      );
      expect(session.user?.allowedApps).toBeUndefined();
    });

    it('should handle thrown errors gracefully and return authenticated: false', async () => {
      mockGet.mockImplementation(() => {
        throw new Error('Cookies reading failed');
      });

      const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const session = await getIndustrialSession();

      expect(session).toEqual({ authenticated: false });

      warnSpy.mockRestore();
    });
  });

  describe('ensureIndustrialAccess', () => {
    it('should throw UnauthorizedAccessError if the user is not authenticated', async () => {
      mockGet.mockReturnValue(undefined); // Missing cookie

      await expect(ensureIndustrialAccess()).rejects.toThrow(UnauthorizedAccessError);
    });

    it('should throw InsufficientPrivilegesError if the user lacks the required role', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@abd.com',
        role: 'USER',
        tenantId: 'tenant-abc',
      };
      mockGet.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(mockPayload);

      await expect(ensureIndustrialAccess('ADMIN')).rejects.toThrow(InsufficientPrivilegesError);
    });

    it('should return user profile if the user matches the required role', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@abd.com',
        role: 'ADMIN',
        tenantId: 'tenant-abc',
      };
      mockGet.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(mockPayload);

      const user = await ensureIndustrialAccess('ADMIN');

      expect(user.id).toBe('user-123');
      expect(user.role).toBe('ADMIN');
    });

    it('should bypass role restrictions and permit access if the user is a SUPER_ADMIN', async () => {
      const mockPayload = {
        sub: 'super-admin-123',
        email: 'super@abd.com',
        role: 'SUPER_ADMIN',
        tenantId: 'GLOBAL',
      };
      mockGet.mockReturnValue({ value: 'valid-token' });
      mockVerifyToken.mockResolvedValue(mockPayload);

      const user = await ensureIndustrialAccess('ADMIN');

      expect(user.id).toBe('super-admin-123');
      expect(user.role).toBe('SUPER_ADMIN');
    });
  });
});
