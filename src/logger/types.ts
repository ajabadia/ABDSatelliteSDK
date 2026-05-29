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
