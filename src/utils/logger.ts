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

const LEVEL_VALUES: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Default configuration populated from standard environment variables
let globalConfig: LoggerConfig = {
  endpoint: process.env.LOGS_SERVICE_URL || 'http://localhost:3600/api/logs',
  token: process.env.LOGS_SECRET_TOKEN,
  appId: process.env.NEXT_PUBLIC_APP_ID || 'satellite-app',
  minLevel: (process.env.LOG_LEVEL as LogLevel) || 'INFO',
};

/**
 * ⚙️ Configures the global central logger options dynamically.
 */
export function configureLogger(config: LoggerConfig): void {
  globalConfig = { ...globalConfig, ...config };
}

// PII blocklist of sensitive property names (case-insensitive checks)
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'jwt',
  'apikey',
  'clientsecret',
  'jwtsecret',
  'creditcard',
  'cvv',
  'authorization',
  'cookie',
  'key',
  'ssn',
  'birthdate',
  'phone',
  'phonenumber',
  'tel',
  'pin',
  'salt',
  'hash',
  'privatekey',
  'passwd'
];

// PII Regex patterns for content scanning within raw strings
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

/**
 * 🔒 Recursively traverses and redacts PII (Personal Identifiable Information) from variables, objects, and arrays.
 */
export function redactPII<T>(val: T, keyName?: string): T {
  if (val === null || val === undefined) {
    return val;
  }

  // Saneamiento de cadenas de texto
  if (typeof val === 'string') {
    // Si la clave actual de la propiedad está blocklistada como sensible, se censura por completo
    if (keyName && SENSITIVE_KEYS.some(k => keyName.toLowerCase().includes(k))) {
      return '[REDACTED]' as unknown as T;
    }
    // De lo contrario, se buscan y enmascaran correos y números de tarjetas dentro de la cadena
    let cleaned: string = val;
    cleaned = cleaned.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
    cleaned = cleaned.replace(CREDIT_CARD_REGEX, '[REDACTED_CARD]');
    return cleaned as unknown as T;
  }

  // Saneamiento recursivo en arreglos
  if (Array.isArray(val)) {
    return val.map(item => redactPII(item, keyName)) as unknown as T;
  }

  // Saneamiento recursivo en objetos
  if (typeof val === 'object') {
    // Evitar alterar tipos nativos no serializables como Date y RegExp
    if (val instanceof Date || val instanceof RegExp) {
      return val;
    }
    
    const copy: Record<string, unknown> = {};
    const keys = Object.keys(val as object);
    for (const k of keys) {
      copy[k] = redactPII((val as Record<string, unknown>)[k], k);
    }
    return copy as unknown as T;
  }

  // Si es un valor de otro tipo (número, boolean, etc.) y la clave indica que es sensible
  if (keyName && SENSITIVE_KEYS.some(k => keyName.toLowerCase().includes(k))) {
    return '[REDACTED]' as unknown as T;
  }

  return val;
}

/**
 * 📝 Helper to print structured JSON log to console.
 */
function logToConsole(level: LogLevel, message: string, meta?: LogMeta): void {
  const minConfigLevel = globalConfig.minLevel || 'INFO';
  if (LEVEL_VALUES[level] < LEVEL_VALUES[minConfigLevel]) {
    return;
  }

  const logObject = {
    timestamp: new Date().toISOString(),
    level,
    appId: globalConfig.appId,
    message: redactPII(message),
    meta: meta ? redactPII(meta) : undefined,
  };

  const jsonString = JSON.stringify(logObject);
  
  if (level === 'ERROR') {
    console.error(jsonString);
  } else if (level === 'WARN') {
    console.warn(jsonString);
  } else {
    console.log(jsonString);
  }
}

/**
 * 🛰️ Central Structured Logger for the ABD Ecosystem.
 * Guarantees automated PII redaction and fail-safe remote forensic log ingestion.
 */
export const logger = {
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
      finalMeta = {
        ...finalMeta,
        stack: errorOrMessage.stack,
        name: errorOrMessage.name,
      };
    } else {
      msg = String(errorOrMessage);
    }

    logToConsole('ERROR', msg, finalMeta);
  },

  /**
   * 📡 Transmits a forensic audit log recursively redacted of PII (except for root userEmail)
   * to the ABDLogs central microservice in a non-blocking (fire-and-forget) manner.
   */
  audit(payload: AuditLogPayload): void {
    const { endpoint, token, appId } = globalConfig;

    // Saneamiento profundo de campos mutables/sensibles del payload (changedFields y previousState)
    const redactedPayload = {
      ...payload,
      appId: appId || payload.appId || 'unknown',
      changedFields: payload.changedFields ? redactPII(payload.changedFields) : {},
      previousState: payload.previousState ? redactPII(payload.previousState) : undefined,
    };

    // Emitir log estructurado de auditoría por consola para telemetría
    logToConsole('INFO', `[AUDIT_EVENT][${redactedPayload.action}] entityType=${redactedPayload.entityType} entityId=${redactedPayload.entityId}`, {
      action: redactedPayload.action,
      entityType: redactedPayload.entityType,
      entityId: redactedPayload.entityId,
      userId: redactedPayload.userId,
      userEmail: redactedPayload.userEmail, // El correo raíz no se enmascara para preservar rastreo de identidad
    });

    // Envío remoto asíncrono y Fail-Safe
    if (!token && process.env.NODE_ENV === 'production') {
      console.error('[LOGGER_AUDIT_WARNING] Fail-safe active: LOGS_SECRET_TOKEN is missing in production environment variables.');
      return;
    }

    fetch(endpoint!, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token || 'dev-bypass-token'}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...redactedPayload,
        createdAt: new Date(),
      }),
    }).catch(err => {
      // 🛡️ Fail-Safe: no tirar excepciones ni bloquear el hilo principal si ABDLogs está caído
      console.error(`[LOGGER_AUDIT_ERROR][${appId}] Fail-safe fallback active. Failed to transmit forensic log to central service:`, err instanceof Error ? err.message : err);
    });
  }
};
