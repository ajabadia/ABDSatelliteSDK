/**
 * @purpose Gestiona el estado de conexión y registro para la aplicación ABDSatelliteSDK.
 * @purpose_en Manages logging and connection status for the ABDSatelliteSDK application.
 * @refactorable true (contains too many state variables and UI parts)
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:3,imports:4,sig:05njbk
 * @lastUpdated 2026-06-23T20:31:10.809Z
 */

import type { AuditLogPayload, LoggerConfig, ConnectionStatus, ConnectionSubscriber, LogMeta } from './types';
export type { LogLevel, LoggerConfig, LogMeta, AuditLogPayload, ConnectionStatus, ConnectionSubscriber } from './types';
export { redactPII } from './redact-pii';
export { LEVEL_VALUES } from './types';
import { LEVEL_VALUES } from './types';
import { redactPII } from './redact-pii';
import { getBuffer, addToBuffer, flushBuffer as flushOfflineBuffer, clearBuffer } from './offline-buffer';

let globalConfig: LoggerConfig = { endpoint: process.env.LOGS_SERVICE_URL || 'http://localhost:5003/api/logs', token: process.env.LOGS_SECRET_TOKEN, appId: process.env.NEXT_PUBLIC_APP_ID || 'satellite-app', minLevel: (process.env.LOG_LEVEL as any) || 'INFO' };
let connectionStatus: ConnectionStatus = 'unknown';
const subscribers = new Set<ConnectionSubscriber>();

function logToConsole(level: string, message: string, meta?: LogMeta): void {
  const minConfigLevel = globalConfig.minLevel || 'INFO';
  if (LEVEL_VALUES[level as keyof typeof LEVEL_VALUES] < LEVEL_VALUES[minConfigLevel]) return;
  const logObject = { timestamp: new Date().toISOString(), level, appId: globalConfig.appId, message: redactPII(message), meta: meta ? redactPII(meta) : undefined };
  const jsonString = JSON.stringify(logObject);
  if (level === 'ERROR') console.error(jsonString); else if (level === 'WARN') console.warn(jsonString); else console.log(jsonString);
}

function notifySubscribers(status: ConnectionStatus) { for (const cb of subscribers) { try { cb(status); } catch { /* ignore */ } } }

function getBaseUrl(): string {
  const url = globalConfig.endpoint || 'http://localhost:5003/api/logs';
  try { const parsed = new URL(url); return `${parsed.protocol}//${parsed.host}`; } catch { return url.replace('/api/logs', ''); }
}

export const logger = {
  debug(message: string, meta?: LogMeta): void { logToConsole('DEBUG', message, meta); },
  info(message: string, meta?: LogMeta): void { logToConsole('INFO', message, meta); },
  warn(message: string, meta?: LogMeta): void { logToConsole('WARN', message, meta); },
  error(message: string, errorOrMessage: unknown, meta?: LogMeta): void {
    const msg = errorOrMessage instanceof Error ? errorOrMessage.message : String(errorOrMessage);
    logToConsole('ERROR', msg, errorOrMessage instanceof Error ? { ...(meta || {}), stack: errorOrMessage.stack, name: errorOrMessage.name } : meta);
  },
  async audit(payload: AuditLogPayload): Promise<void> {
    const { endpoint, token, appId } = globalConfig;
    const redactedPayload = { ...payload, appId: appId || payload.appId || 'unknown', changedFields: payload.changedFields ? redactPII(payload.changedFields) : {}, previousState: payload.previousState ? redactPII(payload.previousState) : undefined };
    logToConsole('INFO', `[AUDIT_EVENT][${redactedPayload.action}] entityType=${redactedPayload.entityType}`, { action: redactedPayload.action, entityType: redactedPayload.entityType, entityId: redactedPayload.entityId, userId: redactedPayload.userId, userEmail: redactedPayload.userEmail });
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser && getBuffer().length > 0) flushOfflineBuffer(endpoint!, token, appId).catch(() => {});
    if (!token && process.env.NODE_ENV === 'production') { console.error('[LOGGER_AUDIT_WARNING] LOGS_SECRET_TOKEN is missing in production.'); return; }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(endpoint!, { method: 'POST', headers: { Authorization: `Bearer ${token || 'dev-bypass-token'}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...redactedPayload, createdAt: new Date() }), signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`ABDLogs responded with HTTP ${response.status}`);
      connectionStatus = 'connected'; notifySubscribers('connected');
      if (isBrowser) flushOfflineBuffer(endpoint!, token, appId).catch(() => {});
    } catch (error) {
      const message = error instanceof Error ? (error.name === 'AbortError' ? 'Request timeout (10s)' : error.message) : 'Unknown error';
      if (isBrowser) { addToBuffer(payload); connectionStatus = 'disconnected'; notifySubscribers('disconnected'); }
      else console.warn(`[Logger] ⚠️ Failed to send audit log (server-side): ${message}`);
    }
  },
  async checkConnection(): Promise<{ connected: boolean; latency: number; error?: string }> {
    const healthUrl = `${getBaseUrl()}/api/logs/health`; const start = Date.now();
    try {
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(healthUrl, { method: 'GET', signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeout); const latency = Date.now() - start;
      if (!response.ok) throw new Error(`Health check responded with HTTP ${response.status}`);
      connectionStatus = 'connected'; notifySubscribers('connected'); return { connected: true, latency };
    } catch (error) {
      connectionStatus = 'disconnected'; notifySubscribers('disconnected');
      return { connected: false, latency: Date.now() - start, error: error instanceof Error ? (error.name === 'AbortError' ? 'Connection timeout (5s)' : error.message) : 'Unknown error' };
    }
  },
  getConnectionStatus(): ConnectionStatus { return connectionStatus; },
  onConnectionChange(callback: ConnectionSubscriber): () => void { subscribers.add(callback); return () => { subscribers.delete(callback); }; },
  getBufferSize(): number { return getBuffer().length; },
  async flushBuffer() { return flushOfflineBuffer(globalConfig.endpoint!, globalConfig.token, globalConfig.appId); },
  clearBuffer(): void { clearBuffer(); },
  _resetForTest(): void { connectionStatus = 'unknown'; subscribers.clear(); },
};

export function configureLogger(config: LoggerConfig): void { globalConfig = { ...globalConfig, ...config }; }
