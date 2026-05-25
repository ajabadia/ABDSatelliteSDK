import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { RateLimiter, createRateLimiter } from './rateLimiter';

// Mock the logger to prevent console output during tests
vi.mock('./logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic functionality', () => {
    it('should allow requests when tokens are available', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 5 });
      
      // First 5 requests should succeed (burst size)
      for (let i = 0; i < 5; i++) {
        expect(limiter.tryAcquire('test')).toBe(true);
      }
    });

    it('should deny requests when tokens are exhausted', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 2 });
      
      // Use up all tokens
      expect(limiter.tryAcquire('test')).toBe(true);
      expect(limiter.tryAcquire('test')).toBe(true);
      
      // Should be denied now
      expect(limiter.tryAcquire('test')).toBe(false);
    });

    it('should track tokens per key independently', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 2 });
      
      // Exhaust tokens for 'key1'
      expect(limiter.tryAcquire('key1')).toBe(true);
      expect(limiter.tryAcquire('key1')).toBe(true);
      expect(limiter.tryAcquire('key1')).toBe(false);
      
      // 'key2' should still have tokens
      expect(limiter.tryAcquire('key2')).toBe(true);
    });

    it('should use default options when not specified', () => {
      const limiter = new RateLimiter();
      
      // Should allow burst of 20 requests
      for (let i = 0; i < 20; i++) {
        expect(limiter.tryAcquire('test')).toBe(true);
      }
      
      // 21st should fail
      expect(limiter.tryAcquire('test')).toBe(false);
    });
  });

  describe('Token refill over time', () => {
    it('should refill tokens as time passes', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 5 });
      
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        limiter.tryAcquire('test');
      }
      
      expect(limiter.tryAcquire('test')).toBe(false);
      
      // Advance time by 100ms (should add ~1 token at 10 req/s)
      vi.advanceTimersByTime(100);
      
      expect(limiter.tryAcquire('test')).toBe(true);
    });

    it('should not exceed max tokens on refill', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 5 });
      
      // Use 1 token
      limiter.tryAcquire('test');
      
      // Advance time significantly (should cap at maxTokens)
      vi.advanceTimersByTime(10000); // 10 seconds = 100 tokens, but max is 5
      
      // Should have 5 tokens (max), not 100
      for (let i = 0; i < 5; i++) {
        expect(limiter.tryAcquire('test')).toBe(true);
      }
    });
  });

  // Note: waitForToken is tested indirectly via execute() tests
  // Direct testing of waitForToken with fake timers is complex due to the async loop

  describe('execute helper', () => {
    it('should execute function with rate limiting', async () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 2 });
      
      let executionCount = 0;
      const fn = async () => {
        executionCount++;
        return executionCount;
      };
      
      const result1 = await limiter.execute('test', fn);
      const result2 = await limiter.execute('test', fn);
      
      expect(result1).toBe(1);
      expect(result2).toBe(2);
    });

    it('should pass through function result', async () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 5 });
      
      const result = await limiter.execute('test', async () => {
        return { success: true, data: [1, 2, 3] };
      });
      
      expect(result).toEqual({ success: true, data: [1, 2, 3] });
    });

    it('should propagate function errors', async () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 5 });
      
      const error = new Error('Test error');
      const promise = limiter.execute('test', async () => {
        throw error;
      });
      
      await expect(promise).rejects.toThrow('Test error');
    });
  });

  describe('getTokens', () => {
    it('should return current token count', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 5 });
      
      expect(limiter.getTokens('test')).toBe(5);
      
      limiter.tryAcquire('test');
      expect(limiter.getTokens('test')).toBe(4);
    });

    it('should return maxTokens for unknown key', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 5 });
      
      expect(limiter.getTokens('unknown')).toBe(5);
    });

    it('should account for time-based refill', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 5 });
      
      limiter.tryAcquire('test');
      expect(limiter.getTokens('test')).toBe(4);
      
      // Advance 100ms = 1 token refilled
      vi.advanceTimersByTime(100);
      expect(limiter.getTokens('test')).toBe(5); // Capped at max
    });
  });

  describe('reset', () => {
    it('should reset specific key', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 2 });
      
      limiter.tryAcquire('key1');
      limiter.tryAcquire('key1');
      limiter.tryAcquire('key2');
      
      limiter.reset('key1');
      
      // key1 should be reset
      expect(limiter.getTokens('key1')).toBe(2);
      
      // key2 should be unchanged
      expect(limiter.getTokens('key2')).toBe(1);
    });

    it('should reset all keys when called without argument', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 2 });
      
      limiter.tryAcquire('key1');
      limiter.tryAcquire('key2');
      
      limiter.reset();
      
      expect(limiter.getTokens('key1')).toBe(2);
      expect(limiter.getTokens('key2')).toBe(2);
    });
  });

  describe('getTrackedKeysCount', () => {
    it('should return number of tracked keys', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 5 });
      
      expect(limiter.getTrackedKeysCount()).toBe(0);
      
      limiter.tryAcquire('key1');
      expect(limiter.getTrackedKeysCount()).toBe(1);
      
      limiter.tryAcquire('key2');
      expect(limiter.getTrackedKeysCount()).toBe(2);
    });

    it('should not count keys with no activity', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 5 });
      
      limiter.tryAcquire('used');
      limiter.getTokens('unused'); // Just checking, not using
      limiter.getTokens('also-unused');
      
      expect(limiter.getTrackedKeysCount()).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle burst size of 1', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 1 });
      
      expect(limiter.tryAcquire('test')).toBe(true);
      expect(limiter.tryAcquire('test')).toBe(false);
    });

    it('should handle very high rate', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 1000, burstSize: 100 });
      
      for (let i = 0; i < 100; i++) {
        expect(limiter.tryAcquire('test')).toBe(true);
      }
      
      expect(limiter.tryAcquire('test')).toBe(false);
    });

    it('should handle rate of 0', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 0, burstSize: 1 });
      
      expect(limiter.tryAcquire('test')).toBe(true);
      expect(limiter.tryAcquire('test')).toBe(false);
    });
  });

  describe('Configuration options', () => {
    it('should respect requestsPerSecond', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 5, burstSize: 5 });
      
      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        limiter.tryAcquire('test');
      }
      
      // At 5 req/s, 200ms should give 1 token
      vi.advanceTimersByTime(200);
      
      expect(limiter.tryAcquire('test')).toBe(true);
    });

    it('should respect burstSize', () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 50 });
      
      for (let i = 0; i < 50; i++) {
        expect(limiter.tryAcquire('test')).toBe(true);
      }
      
      expect(limiter.tryAcquire('test')).toBe(false);
    });

    it('should respect minDelayMs in waitForToken', async () => {
      const limiter = createRateLimiter({ requestsPerSecond: 10, burstSize: 1, minDelayMs: 100 });
      
      limiter.tryAcquire('test');
      
      const start = Date.now();
      const promise = limiter.waitForToken('test');
      
      // Advance exactly 99ms - should not resolve yet
      vi.advanceTimersByTime(99);
      vi.advanceTimersToNextTimer();
      
      let resolved = false;
      promise.then(() => { resolved = true; });
      
      // At 99ms with 100ms minDelay, should not be resolved
      expect(resolved).toBe(false);
      
      // Advance to 100ms
      vi.advanceTimersByTime(1);
      vi.advanceTimersToNextTimer();
      
      await expect(promise).resolves.toBeUndefined();
    });
  });
});

describe('createRateLimiter', () => {
  it('should create limiter with custom options', () => {
    const limiter = createRateLimiter({
      requestsPerSecond: 20,
      burstSize: 30,
      minDelayMs: 25
    });
    
    // Should allow burst of 30
    for (let i = 0; i < 30; i++) {
      expect(limiter.tryAcquire('test')).toBe(true);
    }
    
    expect(limiter.tryAcquire('test')).toBe(false);
  });

  it('should create independent limiters', () => {
    const limiter1 = createRateLimiter({ requestsPerSecond: 10, burstSize: 2 });
    const limiter2 = createRateLimiter({ requestsPerSecond: 10, burstSize: 5 });
    
    // Use limiter1 tokens
    limiter1.tryAcquire('test');
    limiter1.tryAcquire('test');
    
    // limiter2 should be unaffected
    for (let i = 0; i < 5; i++) {
      expect(limiter2.tryAcquire('test')).toBe(true);
    }
  });
});