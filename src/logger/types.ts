/**
 * @purpose Proporciona definiciones de tipos y interfaces para configuraciones de registro, payloads y estados de conexión dentro del ABDSatelliteSDK.
 * @purpose_en Defines types and interfaces for logging configurations, payloads, and connection statuses within the ABDSatelliteSDK.
 * @refactorable false
 * @classification Type Definition
 * @complexity Low
 * @fingerprint exports:8,imports:0,sig:1ju13o
 * @lastUpdated 2026-06-23T20:31:26.158Z
 */

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

export type ConnectionStatus = 'unknown' | 'connected' | 'disconnected';
export type ConnectionSubscriber = (status: ConnectionStatus) => void;

export interface BufferedEntry {
  payload: AuditLogPayload;
  timestamp: number;
  retries: number;
}

export const LEVEL_VALUES: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};
