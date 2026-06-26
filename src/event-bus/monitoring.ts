/**
 * @purpose Gestiona y recupera información del flujo de eventos de Redis.
 * @purpose_en Manages and retrieves event stream information from Redis.
 * @refactorable false
 * @classification Business Service
 * @complexity Low
 * @fingerprint exports:2,imports:3,sig:175p7zn
 * @lastUpdated 2026-06-26T06:17:59.966Z
 */

import { Redis } from '@upstash/redis';
import { SystemEventType } from '../auth-middleware/events';
import type { StreamInfo, StreamEventEntry } from './types';

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function getAllStreamInfo(): Promise<StreamInfo[]> {
  const redis = getRedis();
  if (!redis) return [];

  const eventTypes = Object.values(SystemEventType);
  const results: StreamInfo[] = [];

  for (const eventType of eventTypes) {
    try {
      const streamKey = `events:${eventType}`;
      const length = await redis.xlen(streamKey);
      results.push({ eventType, streamKey, length });
    } catch {
      results.push({ eventType, streamKey: `events:${eventType}`, length: 0 });
    }
  }

  return results;
}

export async function getStreamRecentEvents(eventType: string, count = 20): Promise<StreamEventEntry[]> {
  const redis = getRedis();
  if (!redis) return [];

  const streamKey = `events:${eventType}`;
  try {
    const response = await redis.xrange<Record<string, string>>(streamKey, '-', '+', count);
    if (!response) return [];

    const entries: StreamEventEntry[] = [];
    for (const [id, fields] of Object.entries(response)) {
      const payloadRaw = fields['payload'];
      let payload: Record<string, unknown> = {};
      let timestamp = new Date(parseInt(id.split('-')[0])).toISOString();
      if (payloadRaw) {
        try {
          payload = JSON.parse(payloadRaw) as Record<string, unknown>;
          timestamp = (payload as { timestamp?: string }).timestamp || timestamp;
        } catch {
          // skip malformed payload
        }
      }
      entries.push({ id, data: payload, timestamp });
    }
    return entries.reverse();
  } catch {
    return [];
  }
}
