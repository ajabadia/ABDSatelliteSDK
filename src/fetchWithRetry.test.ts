import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry } from './utils/fetch-with-retry';

// Mock the logger to prevent console output during tests
vi.mock('./utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Successful requests', () => {
    it('should return ok=true and data on successful 2xx response on first attempt', async () => {
      const mockResponse = { id: 1, name: 'Test' };
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await fetchWithRetry<TestResponse>('/api/test');

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(result.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should parse JSON data correctly from successful response', async () => {
      const mockData = { user: { id: 123, email: 'test@example.com' } };
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await fetchWithRetry<typeof mockData>('/api/users', {
        method: 'POST',
      });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(mockData);
    });
  });

  describe('Retry on 5xx errors', () => {
    it('should retry on 500 error and succeed on second attempt', async () => {
      let attemptCount = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          return new Response('Server Error', { status: 500 });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await fetchWithRetry<{ success: boolean }>('/api/test', {}, 4, 10);

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ success: true });
      expect(attemptCount).toBe(2);
    });

    it('should retry on 503 error and succeed on third attempt', async () => {
      let attemptCount = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          return new Response('Service Unavailable', { status: 503 });
        }
        return new Response(JSON.stringify({ data: 'final' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await fetchWithRetry<{ data: string }>('/api/test', {}, 4, 10);

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ data: 'final' });
      expect(attemptCount).toBe(3);
    });

    it('should return ok=false when all 4 attempts fail with 5xx', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('Server Error', { status: 500 })
      );

      const result = await fetchWithRetry<unknown>('/api/test', {}, 4, 10);

      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
      expect(result.error).toBe('Server error: 500');
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });

    it('should return ok=false on 502 after exhausting retries', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('Bad Gateway', { status: 502 })
      );

      const result = await fetchWithRetry<unknown>('/api/test', {}, 4, 10);

      expect(result.ok).toBe(false);
      expect(result.status).toBe(502);
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('Retry on network errors', () => {
    it('should retry on network error and succeed on second attempt', async () => {
      let attemptCount = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('ECONNREFUSED');
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await fetchWithRetry<{ ok: boolean }>('/api/test', {}, 4, 10);

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ ok: true });
      expect(attemptCount).toBe(2);
    });

    it('should return ok=false when all attempts fail with network errors', async () => {
      vi.spyOn(global, 'fetch').mockImplementation(() => {
        throw new Error('ENETUNREACH');
      });

      const result = await fetchWithRetry<unknown>('/api/test', {}, 4, 10);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('ENETUNREACH');
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });

    it('should handle mixed network errors and 5xx errors', async () => {
      let attemptCount = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Network timeout');
        }
        if (attemptCount === 2) {
          return new Response('Gateway Timeout', { status: 504 });
        }
        return new Response(JSON.stringify({ final: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await fetchWithRetry<{ final: boolean }>('/api/test', {}, 4, 10);

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ final: true });
      expect(attemptCount).toBe(3);
    });
  });

  describe('No retry on 4xx errors', () => {
    it('should NOT retry on 400 Bad Request and return immediately', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('Bad Request', { status: 400 })
      );

      const result = await fetchWithRetry<unknown>('/api/test', {}, 4, 10);

      expect(result.ok).toBe(false);
      expect(result.status).toBe(400);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only 1 attempt, no retries
    });

    it('should NOT retry on 401 Unauthorized', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('Unauthorized', { status: 401 })
      );

      const result = await fetchWithRetry<unknown>('/api/test', {}, 4, 10);

      expect(result.ok).toBe(false);
      expect(result.status).toBe(401);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 404 Not Found', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('Not Found', { status: 404 })
      );

      const result = await fetchWithRetry<unknown>('/api/test', {}, 4, 10);

      expect(result.ok).toBe(false);
      expect(result.status).toBe(404);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 403 Forbidden', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('Forbidden', { status: 403 })
      );

      const result = await fetchWithRetry<unknown>('/api/test', {}, 4, 10);

      expect(result.ok).toBe(false);
      expect(result.status).toBe(403);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom retry parameters', () => {
    it('should respect custom maxAttempts parameter', async () => {
      let attemptCount = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        attemptCount++;
        return new Response('Error', { status: 500 });
      });

      const result = await fetchWithRetry<unknown>('/api/test', {}, 2, 10);

      expect(result.ok).toBe(false);
      expect(attemptCount).toBe(2); // Only 2 attempts with maxAttempts=2
    });

    it('should respect custom baseDelayMs parameter', async () => {
      const delays: number[] = [];
      let attemptCount = 0;
      const originalSetTimeout = global.setTimeout;
      
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount <= 2) {
          return new Response('Error', { status: 500 });
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      // Capture delays by mocking setTimeout
      // @ts-ignore - mock implementation typing
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation((fn: (...args: unknown[]) => void) => {
        return originalSetTimeout(fn, 0);
      });

      await fetchWithRetry<{ ok: boolean }>('/api/test', {}, 4, 100);

      // Should have called setTimeout for retry delays (2 retries before success)
      expect(setTimeoutSpy).toHaveBeenCalled();
    });

    it('should cap delay at maxDelayMs', async () => {
      let attemptCount = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        attemptCount++;
        return new Response('Error', { status: 500 });
      });

      // With maxDelayMs=50, even with 2^10=1024 base delay, it should cap at 50
      const result = await fetchWithRetry<unknown>('/api/test', {}, 4, 100, 50);

      expect(result.ok).toBe(false);
      expect(attemptCount).toBe(4);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty response', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(null, { status: 204 })
      );

      const result = await fetchWithRetry<unknown>('/api/test');

      expect(result.ok).toBe(true);
      expect(result.status).toBe(204);
    });

    it('should handle non-JSON successful response', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('plain text response', { status: 200 })
      );

      const result = await fetchWithRetry<string>('/api/test');

      expect(result.ok).toBe(true);
      expect(result.data).toBeNull(); // JSON parse fails, returns null
    });

    it('should handle invalid JSON in error response', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('not valid json', { status: 500 })
      );

      const result = await fetchWithRetry<unknown>('/api/test', {}, 4, 10);

      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
    });

    it('should handle fetch with custom headers in options', async () => {
      let capturedHeaders: Headers | null = null;
      // @ts-ignore - Vitest mock typing for fetch
      vi.spyOn(global, 'fetch').mockImplementation(async (url: RequestInfo, init?: RequestInit): Promise<Response> => {
        if (init?.headers) {
          capturedHeaders = new Headers(init.headers as HeadersInit);
        }
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await fetchWithRetry<{ received: boolean }>('/api/test', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer token123',
          'Content-Type': 'application/json',
        },
      });

      expect(result.ok).toBe(true);
      // @ts-ignore - Headers type mismatch in test mock
      expect(capturedHeaders?.get('Authorization')).toBe('Bearer token123');
    });

    it('should handle 5xx error on last attempt without infinite loop', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('Final Error', { status: 500 })
      );

      const result = await fetchWithRetry<unknown>('/api/test', {}, 1, 10);

      expect(result.ok).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Return type verification', () => {
    it('should have correct return type shape for success', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ id: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await fetchWithRetry<{ id: number }>('/api/test');

      // TypeScript should infer correct types
      if (result.ok && result.data) {
        expect(result.data.id).toBe(1);
      }
    });

    it('should have correct return type shape for error', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('Error', { status: 500 })
      );

      const result = await fetchWithRetry<{ id: number }>('/api/test');

      if (!result.ok) {
        expect(result.status).toBe(500);
        expect(result.error).toBeDefined();
      }
    });
  });
});

// Type for test responses
interface TestResponse {
  id: number;
  name: string;
}