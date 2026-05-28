// ⚠️ Backward-compat re-export — el logger canónico ahora vive en ../logger/index.ts
// Los módulos internos del SDK (session.ts, etc.) importan desde aquí.
export { configureLogger, logger, redactPII } from '../logger';
export type { LoggerConfig, AuditLogPayload, LogMeta, LogLevel } from '../logger';
