/**
 * @purpose Gestiona el consumo de eventos desde un flujo de Redis, maneja los eventos según su tipo y invoca los manejadores registrados.
 * @purpose_en ** Manages event consumption from a Redis stream, handling events based on their type and invoking registered handlers.
 * @refactorable false
 * @classification ** Business Service
 * @complexity ** Medium
 * @fingerprint exports:1,imports:2,sig:1fveqbp
 * @lastUpdated 2026-06-25T09:21:35.544Z
 */

import { Redis } from '@upstash/redis';
import type { EventEnvelope, EventHandler, EventBusConfig } from './types';

interface StreamEntry {
  id: string;
  payload: string;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

interface ConsumerState {
  handlers: Map<string, EventHandler[]>;
  lastIds: Map<string, string>;
  intervalId?: ReturnType<typeof setInterval>;
}

const state: ConsumerState = {
  handlers: new Map(),
  lastIds: new Map(),
};

async function pollOnce(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  for (const [eventType, handlers] of state.handlers.entries()) {
    try {
      const streamKey = `events:${eventType}`;
      const lastId = state.lastIds.get(eventType) || '0';
      const response = await redis.xread(streamKey, lastId);
      if (!response) continue;

      const entries = flattenStreamResponse(response);
      for (const entry of entries) {
        let envelope: EventEnvelope;
        try {
          envelope = JSON.parse(entry.payload) as EventEnvelope;
        } catch {
          continue;
        }
        for (const handler of handlers) {
          await handler(envelope);
        }
        state.lastIds.set(eventType, entry.id);
      }
    } catch {
      // silent — will retry on next poll
    }
  }
}

function flattenStreamResponse(response: unknown): StreamEntry[] {
  const entries: StreamEntry[] = [];
  try {
    const data = response as Array<[string, Array<[string, string[]]>]>;
    for (const [, streams] of data) {
      for (const [id, fields] of streams) {
        const payloadIndex = fields.indexOf('payload');
        if (payloadIndex !== -1 && fields.length > payloadIndex + 1) {
          entries.push({ id, payload: fields[payloadIndex + 1] });
        }
      }
    }
  } catch {
    // malformed response
  }
  return entries;
}

export function createConsumer(config: EventBusConfig) {
  const pollInterval = config.pollIntervalMs ?? 10000;

  return {
    on(eventType: string, handler: EventHandler): void {
      const existing = state.handlers.get(eventType) || [];
      existing.push(handler);
      state.handlers.set(eventType, existing);
      if (!state.lastIds.has(eventType)) {
        state.lastIds.set(eventType, '0');
      }
    },

    start(): void {
      if (state.intervalId) return;
      state.intervalId = setInterval(() => { void pollOnce(); }, pollInterval);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[EVENT_BUS] Consumer started (poll every ${pollInterval}ms)`);
      }
    },

    stop(): void {
      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = undefined;
      }
    },

    async pollOnce(): Promise<void> {
      return pollOnce();
    },
  };
}
