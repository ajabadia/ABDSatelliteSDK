/**
 * @purpose Proporciona un cliente Redis (Upstash REST) para cachear sesiones y verificaciones con fallback transparente.
 * @purpose_en Provides a Redis client (Upstash REST) for caching sessions and verifications with transparent fallback.
 */

import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[REDIS] UPSTASH_REDIS_REST_URL/TOKEN not configured — Redis cache disabled');
    }
    return null;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;
    return await redis.get<T>(key);
  } catch {
    return null;
  }
}

export async function setCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // silent fallback
  }
}

export async function delCache(key: string): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.del(key);
  } catch {
    // silent fallback
  }
}

export function sessionCacheKey(tokenHash: string): string {
  return `session:${tokenHash}`;
}

export function verifyCacheKey(email: string, sessionId: string): string {
  return `session:verify:${email}:${sessionId}`;
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
