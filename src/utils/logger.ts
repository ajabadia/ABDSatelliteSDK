/**
 * @purpose Proporciona funciones y tipos de registro desde el módulo de registro canonical.
 * @purpose_en Exports logging functions and types from the canonical logger module.
 * @refactorable false
 * @classification Type Definition
 * @complexity Low
 * @fingerprint exports:1,imports:0,sig:1j413g6
 * @lastUpdated 2026-06-23T20:33:02.156Z
 */

// ⚠️ Backward-compat re-export — el logger canónico ahora vive en ../logger/index.ts
// Los módulos internos del SDK (session.ts, etc.) importan desde aquí.
export { configureLogger, logger, redactPII } from '../logger';
export type { LoggerConfig, AuditLogPayload, LogMeta, LogLevel } from '../logger';
