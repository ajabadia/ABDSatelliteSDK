/**
 * @purpose Gestiona un buffer de almacenamiento offline para payloads de registro, guardandolos en localStorage y enviándolos a un punto de conexión del servidor.
 * @purpose_en Manages an offline buffer for audit log payloads, saving them to localStorage and flushing them to a server endpoint.
 * @refactorable false
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:4,imports:1,sig:1fafg3f
 * @lastUpdated 2026-06-23T20:31:15.673Z
 */

import type { BufferedEntry, AuditLogPayload } from './types';

const BUFFER_KEY = 'abd_logger_buffer';
const MAX_BUFFER_SIZE = 100;
const MAX_RETRIES = 5;

export function getBuffer(): BufferedEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    if (!raw) return [];
    return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBuffer(buffer: BufferedEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = buffer.slice(-MAX_BUFFER_SIZE);
    localStorage.setItem(BUFFER_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[Logger] Failed to save offline buffer to localStorage:', e);
  }
}

export function addToBuffer(payload: AuditLogPayload) {
  const buffer = getBuffer();
  buffer.push({ payload, timestamp: Date.now(), retries: 0 });
  saveBuffer(buffer);
  if (typeof window !== 'undefined') {
    console.warn(`[Logger] 📦 Log buffered offline: ${payload.action} | Buffer: ${buffer.length}/${MAX_BUFFER_SIZE}`);
  }
}

export async function flushBuffer(endpoint: string, token?: string, appId?: string): Promise<{ flushed: number; failed: number; dropped: number }> {
  const buffer = getBuffer();
  if (buffer.length === 0) return { flushed: 0, failed: 0, dropped: 0 };

  let flushed = 0;
  let failed = 0;
  let dropped = 0;
  const remaining: BufferedEntry[] = [];

  for (const entry of buffer) {
    if (entry.retries >= MAX_RETRIES) {
      console.warn(`[Logger] 🗑️ Dropping buffered log after ${MAX_RETRIES} retries: ${entry.payload.action}`);
      dropped++;
      continue;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token || 'dev-bypass-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...entry.payload,
          appId,
          createdAt: new Date(),
        }),
      });

      if (response.ok) {
        flushed++;
      } else {
        entry.retries++;
        remaining.push(entry);
        failed++;
      }
    } catch {
      entry.retries++;
      remaining.push(entry);
      failed++;
    }
  }

  saveBuffer(remaining);

  if (flushed > 0 && typeof window !== 'undefined') {
    console.log(`[Logger] ✅ Flushed ${flushed} buffered log(s) to ABDLogs`);
  }

  return { flushed, failed, dropped };
}

export function clearBuffer(): void {
  saveBuffer([]);
}
