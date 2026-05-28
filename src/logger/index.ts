// ─── Logger SDK con Offline Buffering ───────────────────────────────
// Extraído de ABDQuiz LogsClient y centralizado en @ajabadia/satellite-sdk
// para que todas las apps del ecosistema hereden:
// - Buffering offline en localStorage
// - Pre-flight health check
// - Notificación de estado de conexión
// - Fail-safe en SSR (typeof window)

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LoggerConfig {
  endpoint?: string;
  token?: string;
  appId?: string;
  minLevel?: LogLevel;
}

export interface LogMeta {
  [key: string]: unknown;
}

export interface AuditLogPayload {
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userEmail: string;
  changedFields?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  [key: string]: unknown;
}

type ConnectionStatus = 'unknown' | 'connected' | 'disconnected';
type ConnectionSubscriber = (status: ConnectionStatus) => void;

interface BufferedEntry {
  payload: AuditLogPayload;
  timestamp: number;
  retries: number;
}

const LEVEL_VALUES: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// ─── Configuración global ─────────────────────────────────────────

let globalConfig: LoggerConfig = {
  endpoint: process.env.LOGS_SERVICE_URL || 'http://localhost:3600/api/logs',
  token: process.env.LOGS_SECRET_TOKEN,
  appId: process.env.NEXT_PUBLIC_APP_ID || 'satellite-app',
  minLevel: (process.env.LOG_LEVEL as LogLevel) || 'INFO',
};

let connectionStatus: ConnectionStatus = 'unknown';
const subscribers = new Set<ConnectionSubscriber>();

const BUFFER_KEY = 'abd_logger_buffer';
const MAX_BUFFER_SIZE = 100;
const MAX_RETRIES = 5;

// ─── PII Redaction (heredado del logger original) ─────────────────

const SENSITIVE_KEYS = [
  'password', 'token', 'secret', 'jwt', 'apikey',
  'clientsecret', 'jwtsecret', 'creditcard', 'cvv',
  'authorization', 'cookie', 'key', 'ssn', 'birthdate',
  'phone', 'phonenumber', 'tel', 'pin', 'salt', 'hash',
  'privatekey', 'passwd',
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

/** 🔒 Recursively redacts PII from values */
function redactPII<T>(val: T, keyName?: string): T {
  if (val === null || val === undefined) return val;

  if (typeof val === 'string') {
    if (keyName && SENSITIVE_KEYS.some(k => keyName.toLowerCase().includes(k))) {
      return '[REDACTED]' as unknown as T;
    }
    let cleaned = val.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
    cleaned = cleaned.replace(CREDIT_CARD_REGEX, '[REDACTED_CARD]');
    return cleaned as unknown as T;
  }

  if (Array.isArray(val)) {
    return val.map(item => redactPII(item, keyName)) as unknown as T;
  }

  if (typeof val === 'object') {
    if (val instanceof Date || val instanceof RegExp) return val;
    const copy: Record<string, unknown> = {};
    for (const k of Object.keys(val as object)) {
      copy[k] = redactPII((val as Record<string, unknown>)[k], k);
    }
    return copy as unknown as T;
  }

  if (keyName && SENSITIVE_KEYS.some(k => keyName.toLowerCase().includes(k))) {
    return '[REDACTED]' as unknown as T;
  }

  return val;
}

// ─── Offline Buffering (SSR-safe con typeof window) ───────────────

function getBuffer(): BufferedEntry[] {
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

function addToBuffer(payload: AuditLogPayload) {
  const buffer = getBuffer();
  buffer.push({ payload, timestamp: Date.now(), retries: 0 });
  saveBuffer(buffer);
  if (typeof window !== 'undefined') {
    console.warn(`[Logger] 📦 Log buffered offline: ${payload.action} | Buffer: ${buffer.length}/${MAX_BUFFER_SIZE}`);
  }
}

async function flushBuffer(): Promise<{ flushed: number; failed: number; dropped: number }> {
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
      const response = await fetch(globalConfig.endpoint!, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${globalConfig.token || 'dev-bypass-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...entry.payload,
          appId: globalConfig.appId,
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

// ─── Console output helper ────────────────────────────────────────

function logToConsole(level: LogLevel, message: string, meta?: LogMeta): void {
  const minConfigLevel = globalConfig.minLevel || 'INFO';
  if (LEVEL_VALUES[level] < LEVEL_VALUES[minConfigLevel]) return;

  const logObject = {
    timestamp: new Date().toISOString(),
    level,
    appId: globalConfig.appId,
    message: redactPII(message),
    meta: meta ? redactPII(meta) : undefined,
  };

  const jsonString = JSON.stringify(logObject);

  if (level === 'ERROR') console.error(jsonString);
  else if (level === 'WARN') console.warn(jsonString);
  else console.log(jsonString);
}

function notifySubscribers(status: ConnectionStatus) {
  for (const cb of subscribers) {
    try { cb(status); } catch { /* ignore subscriber errors */ }
  }
}

function getBaseUrl(): string {
  const url = globalConfig.endpoint || 'http://localhost:3600/api/logs';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url.replace('/api/logs', '');
  }
}

// ─── Logger principal ─────────────────────────────────────────────

export const logger = {
  // ── Nivel de log ──────────────────────────────────────────────

  debug(message: string, meta?: LogMeta): void {
    logToConsole('DEBUG', message, meta);
  },

  info(message: string, meta?: LogMeta): void {
    logToConsole('INFO', message, meta);
  },

  warn(message: string, meta?: LogMeta): void {
    logToConsole('WARN', message, meta);
  },

  error(message: string, errorOrMessage: unknown, meta?: LogMeta): void {
    let msg = '';
    let finalMeta = meta || {};

    if (errorOrMessage instanceof Error) {
      msg = errorOrMessage.message;
      finalMeta = { ...finalMeta, stack: errorOrMessage.stack, name: errorOrMessage.name };
    } else {
      msg = String(errorOrMessage);
    }

    logToConsole('ERROR', msg, finalMeta);
  },

  // ── Audit log con Offline Buffering ───────────────────────────

  /**
   * 📡 Envía un log de auditoría a ABDLogs con buffering offline automático.
   * - Si el envío falla y estamos en cliente → buffer en localStorage
   * - Antes de enviar → intenta vaciar el buffer pendiente
   * - Server-side: solo log de warning si falla (sin localStorage)
   * - Fail-safe: nunca lanza excepciones
   */
  async audit(payload: AuditLogPayload): Promise<void> {
    const { endpoint, token, appId } = globalConfig;

    // Redactar PII en campos mutables
    const redactedPayload = {
      ...payload,
      appId: appId || payload.appId || 'unknown',
      changedFields: payload.changedFields ? redactPII(payload.changedFields) : {},
      previousState: payload.previousState ? redactPII(payload.previousState) : undefined,
    };

    // Console audit trail
    logToConsole('INFO', `[AUDIT_EVENT][${redactedPayload.action}] entityType=${redactedPayload.entityType} entityId=${redactedPayload.entityId}`, {
      action: redactedPayload.action,
      entityType: redactedPayload.entityType,
      entityId: redactedPayload.entityId,
      userId: redactedPayload.userId,
      userEmail: redactedPayload.userEmail,
    });

    // Client-side: flush pending buffer antes de enviar
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser && getBuffer().length > 0) {
      flushBuffer().catch(() => {});
    }

    // Envío remoto
    if (!token && process.env.NODE_ENV === 'production') {
      console.error('[LOGGER_AUDIT_WARNING] LOGS_SECRET_TOKEN is missing in production.');
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(endpoint!, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token || 'dev-bypass-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...redactedPayload,
          createdAt: new Date(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`ABDLogs responded with HTTP ${response.status}`);
      }

      // Success — update status
      connectionStatus = 'connected';
      notifySubscribers('connected');

      // Flush remaining buffer
      if (isBrowser) {
        flushBuffer().catch(() => {});
      }
    } catch (error) {
      const message = error instanceof Error
        ? (error.name === 'AbortError' ? 'Request timeout (10s)' : error.message)
        : 'Unknown error';

      if (isBrowser) {
        addToBuffer(payload);
        connectionStatus = 'disconnected';
        notifySubscribers('disconnected');
      } else {
        console.warn(`[Logger] ⚠️ Failed to send audit log (server-side): ${message}`);
      }
    }
  },

  // ── Connection health check ───────────────────────────────────

  /**
   * 🔌 Pings ABDLogs health endpoint para verificar conectividad.
   * Timeout after 5 seconds.
   */
  async checkConnection(): Promise<{ connected: boolean; latency: number; error?: string }> {
    const healthUrl = `${getBaseUrl()}/api/logs/health`;
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeout);
      const latency = Date.now() - start;

      if (!response.ok) {
        throw new Error(`Health check responded with HTTP ${response.status}`);
      }

      connectionStatus = 'connected';
      notifySubscribers('connected');
      return { connected: true, latency, error: undefined };
    } catch (error) {
      connectionStatus = 'disconnected';
      notifySubscribers('disconnected');

      const latency = Date.now() - start;
      const message = error instanceof Error
        ? (error.name === 'AbortError' ? 'Connection timeout (5s)' : error.message)
        : 'Unknown error';

      return { connected: false, latency, error: message };
    }
  },

  /** Returns current connection status */
  getConnectionStatus(): ConnectionStatus {
    return connectionStatus;
  },

  /** Subscribe to connection changes. Returns unsubscribe function. */
  onConnectionChange(callback: ConnectionSubscriber): () => void {
    subscribers.add(callback);
    return () => { subscribers.delete(callback); };
  },

  /** Returns number of entries in the offline buffer */
  getBufferSize(): number {
    return getBuffer().length;
  },

  /** Attempts to flush buffered logs */
  async flushBuffer(): Promise<{ flushed: number; failed: number; dropped: number }> {
    return flushBuffer();
  },

  /** Clears all buffered entries */
  clearBuffer(): void {
    saveBuffer([]);
  },

  /** @internal Reset for testing */
  _resetForTest(): void {
    connectionStatus = 'unknown';
    subscribers.clear();
  },
};

// ─── Configuración ────────────────────────────────────────────────

/** ⚙️ Configures the global logger options dynamically. */
export function configureLogger(config: LoggerConfig): void {
  globalConfig = { ...globalConfig, ...config };
}

// Re-export original redactPII for backward compatibility
export { redactPII };
