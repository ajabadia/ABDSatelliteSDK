/**
 * @purpose Gestiona el proceso de publicación de eventos utilizando flujos de Redis y un mecanismo de almacenamiento de fallback.
 * @purpose_en Manages the publishing of events using Redis streams and a fallback storage mechanism.
 * @refactorable false
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:1,imports:3,sig:11f0kto
 * @lastUpdated 2026-06-25T09:21:48.229Z
 */

import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import type { EventEnvelope, EventBusConfig } from './types';

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function createPublisher(config: EventBusConfig) {
  const source = config.source;

  return {
    async publish(type: string, data: Record<string, unknown>, subject?: string): Promise<string | null> {
      const envelope: EventEnvelope = {
        id: crypto.randomUUID(),
        type,
        source,
        subject,
        data,
        timestamp: new Date().toISOString(),
        schemaVersion: 1,
      };

      const redis = getRedis();
      if (redis) {
        try {
          const streamKey = `events:${type}`;
          await redis.xadd(streamKey, '*', { payload: JSON.stringify(envelope) });
          return envelope.id;
        } catch (err) {
          console.error(`[EVENT_BUS] Redis publish failed for ${type}, falling back:`, err);
        }
      }

      if (config.fallbackStorage) {
        try {
          await config.fallbackStorage(envelope);
          return envelope.id;
        } catch (fallbackErr) {
          console.error(`[EVENT_BUS] Fallback storage also failed for ${type}:`, fallbackErr);
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        console.warn('[EVENT_BUS] Redis not configured and no fallback — event not published');
      }
      return null;
    },
  };
}
