import {
  FederatedSessionSchema,
  SessionVerifySchema,
  TenantInfoSchema,
  TokenResponseSchema,
  VerifiedTokenPayloadSchema
} from "./chunk-SZEJBU4U.mjs";

// src/types.ts
var QuizEventAction = {
  // ─── Configuración e Ingesta (Administradores/Creators) ───
  SPACE_LINK_CREATE: "QUIZ_SPACE_LINK_CREATE",
  SPACE_LINK_UPDATE: "QUIZ_SPACE_LINK_UPDATE",
  COURSE_CREATE: "QUIZ_COURSE_CREATE",
  COURSE_UPDATE: "QUIZ_COURSE_UPDATE",
  COURSE_DELETE: "QUIZ_COURSE_DELETE",
  EXAM_CONFIG_CREATE: "QUIZ_EXAM_CONFIG_CREATE",
  EXAM_CONFIG_UPDATE: "QUIZ_EXAM_CONFIG_UPDATE",
  ASSIGNMENT_CREATE: "QUIZ_ASSIGNMENT_CREATE",
  ASSIGNMENT_PUBLISH: "QUIZ_ASSIGNMENT_PUBLISHED",
  // ─── Eventos del Alumno (Recipient) ───
  ATTEMPT_STARTED: "QUIZ_ATTEMPT_STARTED",
  ANSWER_SUBMITTED: "QUIZ_ANSWER_SUBMITTED",
  ATTEMPT_COMPLETED: "QUIZ_ATTEMPT_COMPLETED",
  ATTEMPT_TIMEOUT: "QUIZ_ATTEMPT_TIMEOUT",
  // ─── Eventos de Calificación y Auditoría (Creator/Auditor) ───
  ATTEMPT_MANUALLY_GRADED: "QUIZ_ATTEMPT_MANUALLY_GRADED",
  ATTEMPT_INVALIDATED: "QUIZ_ATTEMPT_INVALIDATED",
  // ─── Roles Contextuales ───
  ROLE_ASSIGNED: "QUIZ_ROLE_ASSIGNED",
  ROLE_REVOKED: "QUIZ_ROLE_REVOKED"
};
var QuizEntityType = {
  SPACE: "SPACE",
  COURSE: "COURSE",
  EXAM_CONFIG: "EXAM_CONFIG",
  ASSIGNMENT: "ASSIGNMENT",
  ATTEMPT: "ATTEMPT",
  QUESTION: "QUESTION",
  QUIZ_USER_ROLE: "QUIZ_USER_ROLE"
};

// src/utils/crypto.ts
import { jwtVerify } from "jose";
function getSecretKey(customSecret) {
  const secret = customSecret || process.env.AUTH_JWT_SECRET;
  if (!secret) throw new Error("[SDK] AUTH_JWT_SECRET is required");
  return new TextEncoder().encode(secret);
}
async function verifyToken(token, customSecret) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(customSecret));
    return VerifiedTokenPayloadSchema.parse(payload);
  } catch (err) {
    console.error("[SDK_JWT_VERIFY_ERROR] Failed to verify token:", err instanceof Error ? err.message : err);
    return null;
  }
}

// src/utils/subdomain.ts
function getTenantSubdomain(host, rootDomain) {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  if (hostname === "abd-tenant-gobernance.vercel.app" || hostname === "localhost" || hostname === "127.0.0.1") {
    return null;
  }
  const parts = hostname.split(".");
  const root = rootDomain || process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (root && hostname.endsWith(`.${root}`)) {
    const prefix = hostname.slice(0, -(root.length + 1));
    const parts2 = prefix.split(".");
    const subdomain = parts2[0];
    if (subdomain === "www") return null;
    return subdomain;
  }
  if (hostname.endsWith(".vercel.app")) {
    if (parts.length > 3) {
      return parts[0];
    }
    return null;
  }
  if (parts.length > 2) {
    const subdomain = parts[0];
    if (subdomain === "www") return null;
    return subdomain;
  }
  if (parts.length === 2 && parts[1] === "localhost") {
    const subdomain = parts[0];
    if (subdomain === "www") return null;
    return subdomain;
  }
  return null;
}

// src/proxy.ts
import { NextResponse } from "next/server";

// src/logger/index.ts
var LEVEL_VALUES = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};
var globalConfig = {
  endpoint: process.env.LOGS_SERVICE_URL || "http://localhost:3600/api/logs",
  token: process.env.LOGS_SECRET_TOKEN,
  appId: process.env.NEXT_PUBLIC_APP_ID || "satellite-app",
  minLevel: process.env.LOG_LEVEL || "INFO"
};
var connectionStatus = "unknown";
var subscribers = /* @__PURE__ */ new Set();
var BUFFER_KEY = "abd_logger_buffer";
var MAX_BUFFER_SIZE = 100;
var MAX_RETRIES = 5;
var SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "jwt",
  "apikey",
  "clientsecret",
  "jwtsecret",
  "creditcard",
  "cvv",
  "authorization",
  "cookie",
  "key",
  "ssn",
  "birthdate",
  "phone",
  "phonenumber",
  "tel",
  "pin",
  "salt",
  "hash",
  "privatekey",
  "passwd"
];
var EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
var CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;
function redactPII(val, keyName) {
  if (val === null || val === void 0) return val;
  if (typeof val === "string") {
    if (keyName && SENSITIVE_KEYS.some((k) => keyName.toLowerCase().includes(k))) {
      return "[REDACTED]";
    }
    let cleaned = val.replace(EMAIL_REGEX, "[REDACTED_EMAIL]");
    cleaned = cleaned.replace(CREDIT_CARD_REGEX, "[REDACTED_CARD]");
    return cleaned;
  }
  if (Array.isArray(val)) {
    return val.map((item) => redactPII(item, keyName));
  }
  if (typeof val === "object") {
    if (val instanceof Date || val instanceof RegExp) return val;
    const copy = {};
    for (const k of Object.keys(val)) {
      copy[k] = redactPII(val[k], k);
    }
    return copy;
  }
  if (keyName && SENSITIVE_KEYS.some((k) => keyName.toLowerCase().includes(k))) {
    return "[REDACTED]";
  }
  return val;
}
function getBuffer() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    if (!raw) return [];
    return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveBuffer(buffer) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = buffer.slice(-MAX_BUFFER_SIZE);
    localStorage.setItem(BUFFER_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn("[Logger] Failed to save offline buffer to localStorage:", e);
  }
}
function addToBuffer(payload) {
  const buffer = getBuffer();
  buffer.push({ payload, timestamp: Date.now(), retries: 0 });
  saveBuffer(buffer);
  if (typeof window !== "undefined") {
    console.warn(`[Logger] \u{1F4E6} Log buffered offline: ${payload.action} | Buffer: ${buffer.length}/${MAX_BUFFER_SIZE}`);
  }
}
async function flushBuffer() {
  const buffer = getBuffer();
  if (buffer.length === 0) return { flushed: 0, failed: 0, dropped: 0 };
  let flushed = 0;
  let failed = 0;
  let dropped = 0;
  const remaining = [];
  for (const entry of buffer) {
    if (entry.retries >= MAX_RETRIES) {
      console.warn(`[Logger] \u{1F5D1}\uFE0F Dropping buffered log after ${MAX_RETRIES} retries: ${entry.payload.action}`);
      dropped++;
      continue;
    }
    try {
      const response = await fetch(globalConfig.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${globalConfig.token || "dev-bypass-token"}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...entry.payload,
          appId: globalConfig.appId,
          createdAt: /* @__PURE__ */ new Date()
        })
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
  if (flushed > 0 && typeof window !== "undefined") {
    console.log(`[Logger] \u2705 Flushed ${flushed} buffered log(s) to ABDLogs`);
  }
  return { flushed, failed, dropped };
}
function logToConsole(level, message, meta) {
  const minConfigLevel = globalConfig.minLevel || "INFO";
  if (LEVEL_VALUES[level] < LEVEL_VALUES[minConfigLevel]) return;
  const logObject = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    level,
    appId: globalConfig.appId,
    message: redactPII(message),
    meta: meta ? redactPII(meta) : void 0
  };
  const jsonString = JSON.stringify(logObject);
  if (level === "ERROR") console.error(jsonString);
  else if (level === "WARN") console.warn(jsonString);
  else console.log(jsonString);
}
function notifySubscribers(status) {
  for (const cb of subscribers) {
    try {
      cb(status);
    } catch {
    }
  }
}
function getBaseUrl() {
  const url = globalConfig.endpoint || "http://localhost:3600/api/logs";
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url.replace("/api/logs", "");
  }
}
var logger = {
  // ── Nivel de log ──────────────────────────────────────────────
  debug(message, meta) {
    logToConsole("DEBUG", message, meta);
  },
  info(message, meta) {
    logToConsole("INFO", message, meta);
  },
  warn(message, meta) {
    logToConsole("WARN", message, meta);
  },
  error(message, errorOrMessage, meta) {
    let msg = "";
    let finalMeta = meta || {};
    if (errorOrMessage instanceof Error) {
      msg = errorOrMessage.message;
      finalMeta = { ...finalMeta, stack: errorOrMessage.stack, name: errorOrMessage.name };
    } else {
      msg = String(errorOrMessage);
    }
    logToConsole("ERROR", msg, finalMeta);
  },
  // ── Audit log con Offline Buffering ───────────────────────────
  /**
   * 📡 Envía un log de auditoría a ABDLogs con buffering offline automático.
   * - Si el envío falla y estamos en cliente → buffer en localStorage
   * - Antes de enviar → intenta vaciar el buffer pendiente
   * - Server-side: solo log de warning si falla (sin localStorage)
   * - Fail-safe: nunca lanza excepciones
   */
  async audit(payload) {
    const { endpoint, token, appId } = globalConfig;
    const redactedPayload = {
      ...payload,
      appId: appId || payload.appId || "unknown",
      changedFields: payload.changedFields ? redactPII(payload.changedFields) : {},
      previousState: payload.previousState ? redactPII(payload.previousState) : void 0
    };
    logToConsole("INFO", `[AUDIT_EVENT][${redactedPayload.action}] entityType=${redactedPayload.entityType} entityId=${redactedPayload.entityId}`, {
      action: redactedPayload.action,
      entityType: redactedPayload.entityType,
      entityId: redactedPayload.entityId,
      userId: redactedPayload.userId,
      userEmail: redactedPayload.userEmail
    });
    const isBrowser = typeof window !== "undefined";
    if (isBrowser && getBuffer().length > 0) {
      flushBuffer().catch(() => {
      });
    }
    if (!token && process.env.NODE_ENV === "production") {
      console.error("[LOGGER_AUDIT_WARNING] LOGS_SECRET_TOKEN is missing in production.");
      return;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1e4);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token || "dev-bypass-token"}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...redactedPayload,
          createdAt: /* @__PURE__ */ new Date()
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`ABDLogs responded with HTTP ${response.status}`);
      }
      connectionStatus = "connected";
      notifySubscribers("connected");
      if (isBrowser) {
        flushBuffer().catch(() => {
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.name === "AbortError" ? "Request timeout (10s)" : error.message : "Unknown error";
      if (isBrowser) {
        addToBuffer(payload);
        connectionStatus = "disconnected";
        notifySubscribers("disconnected");
      } else {
        console.warn(`[Logger] \u26A0\uFE0F Failed to send audit log (server-side): ${message}`);
      }
    }
  },
  // ── Connection health check ───────────────────────────────────
  /**
   * 🔌 Pings ABDLogs health endpoint para verificar conectividad.
   * Timeout after 5 seconds.
   */
  async checkConnection() {
    const healthUrl = `${getBaseUrl()}/api/logs/health`;
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5e3);
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store"
      });
      clearTimeout(timeout);
      const latency = Date.now() - start;
      if (!response.ok) {
        throw new Error(`Health check responded with HTTP ${response.status}`);
      }
      connectionStatus = "connected";
      notifySubscribers("connected");
      return { connected: true, latency, error: void 0 };
    } catch (error) {
      connectionStatus = "disconnected";
      notifySubscribers("disconnected");
      const latency = Date.now() - start;
      const message = error instanceof Error ? error.name === "AbortError" ? "Connection timeout (5s)" : error.message : "Unknown error";
      return { connected: false, latency, error: message };
    }
  },
  /** Returns current connection status */
  getConnectionStatus() {
    return connectionStatus;
  },
  /** Subscribe to connection changes. Returns unsubscribe function. */
  onConnectionChange(callback) {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  },
  /** Returns number of entries in the offline buffer */
  getBufferSize() {
    return getBuffer().length;
  },
  /** Attempts to flush buffered logs */
  async flushBuffer() {
    return flushBuffer();
  },
  /** Clears all buffered entries */
  clearBuffer() {
    saveBuffer([]);
  },
  /** @internal Reset for testing */
  _resetForTest() {
    connectionStatus = "unknown";
    subscribers.clear();
  }
};
function configureLogger(config) {
  globalConfig = { ...globalConfig, ...config };
}

// src/utils/rateLimiter.ts
var RateLimiter = class {
  buckets = /* @__PURE__ */ new Map();
  refillRate;
  // tokens per millisecond
  maxTokens;
  minDelayMs;
  /**
   * Create a new RateLimiter
   * 
   * @param options Configuration options
   * @param options.requestsPerSecond - Maximum sustained requests per second (default: 10)
   * @param options.burstSize - Maximum burst of requests allowed (default: 20)
   * @param options.minDelayMs - Minimum delay between requests in ms (default: 50)
   */
  constructor(options = {}) {
    const {
      requestsPerSecond = 10,
      burstSize = 20,
      minDelayMs = 50
    } = options;
    this.refillRate = requestsPerSecond / 1e3;
    this.maxTokens = burstSize;
    this.minDelayMs = minDelayMs;
  }
  /**
   * Check if a request can be made for the given key
   * 
   * @param key - The key to rate limit (e.g., tenantId, 'global')
   * @returns true if request can proceed, false if rate limited
   */
  tryAcquire(key = "global") {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    }
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = timePassed * this.refillRate;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    const waitTimeMs = Math.ceil((1 - bucket.tokens) / this.refillRate);
    logger.warn(`[SDK_RATE_LIMIT] Request blocked for key '${key}'. Wait ${waitTimeMs}ms. Tokens: ${bucket.tokens.toFixed(2)}`);
    return false;
  }
  /**
   * Wait until a request can be made for the given key
   * 
   * @param key - The key to rate limit
   * @param maxWaitMs - Maximum time to wait in milliseconds (default: 5000)
   * @returns Promise that resolves when request can proceed
   * @throws Error if max wait time is exceeded
   */
  async waitForToken(key = "global", maxWaitMs = 5e3) {
    const startTime = Date.now();
    while (!this.tryAcquire(key)) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= maxWaitMs) {
        logger.error(`[SDK_RATE_LIMIT] Wait timeout after ${maxWaitMs}ms for key '${key}'`, new Error("Rate limit timeout"));
        throw new Error(`Rate limit wait timeout after ${maxWaitMs}ms for key '${key}'`);
      }
      const waitTime = Math.min(this.minDelayMs, maxWaitMs - elapsed);
      await new Promise((resolve) => {
        setTimeout(resolve, waitTime);
      });
    }
  }
  /**
   * Execute a function with rate limiting
   * 
   * @param key - The key to rate limit
   * @param fn - The async function to execute
   * @returns The result of the function
   */
  async execute(key, fn) {
    await this.waitForToken(key);
    return fn();
  }
  /**
   * Get current token count for a key (for monitoring/debugging)
   */
  getTokens(key = "global") {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.maxTokens;
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = timePassed * this.refillRate;
    return Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
  }
  /**
   * Reset rate limit for a key
   */
  reset(key) {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }
  /**
   * Get the number of keys being tracked
   */
  getTrackedKeysCount() {
    return this.buckets.size;
  }
};
var idpRateLimiter = new RateLimiter({
  requestsPerSecond: Number(process.env.SDK_RATE_LIMIT_RPS) || 10,
  burstSize: Number(process.env.SDK_RATE_LIMIT_BURST) || 20,
  minDelayMs: Number(process.env.SDK_RATE_LIMIT_MIN_DELAY) || 50
});
function createRateLimiter(options) {
  return new RateLimiter(options);
}

// src/utils/circuitBreaker.ts
var CircuitState = /* @__PURE__ */ ((CircuitState2) => {
  CircuitState2["CLOSED"] = "CLOSED";
  CircuitState2["OPEN"] = "OPEN";
  CircuitState2["HALF_OPEN"] = "HALF_OPEN";
  return CircuitState2;
})(CircuitState || {});
var CircuitBreaker = class {
  state = "CLOSED" /* CLOSED */;
  failureCount = 0;
  lastFailureTime = 0;
  halfOpenSuccesses = 0;
  failureThreshold;
  resetTimeoutMs;
  halfOpenMaxAttempts;
  name;
  /**
   * Create a new CircuitBreaker
   * 
   * @param options Configuration options
   * @param options.failureThreshold - Number of failures before opening circuit (default: 5)
   * @param options.resetTimeoutMs - Time in ms before attempting recovery (default: 30000 = 30s)
   * @param options.halfOpenMaxAttempts - Successful attempts needed to close circuit (default: 3)
   * @param options.name - Name for logging (default: 'idp')
   */
  constructor(options = {}) {
    const {
      failureThreshold = 5,
      resetTimeoutMs = 3e4,
      halfOpenMaxAttempts = 3,
      name = "idp"
    } = options;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.halfOpenMaxAttempts = halfOpenMaxAttempts;
    this.name = name;
  }
  /**
   * Check if circuit allows requests
   */
  canExecute() {
    switch (this.state) {
      case "CLOSED" /* CLOSED */:
        return true;
      case "OPEN" /* OPEN */:
        if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
          this.state = "HALF_OPEN" /* HALF_OPEN */;
          this.halfOpenSuccesses = 0;
          logger.info(`[SDK_CIRCUIT_BREAKER] [${this.name}] Transitioning to HALF_OPEN after ${this.resetTimeoutMs}ms timeout`);
          return true;
        }
        return false;
      case "HALF_OPEN" /* HALF_OPEN */:
        return true;
      default:
        return true;
    }
  }
  /**
   * Record a successful request
   */
  recordSuccess() {
    switch (this.state) {
      case "CLOSED" /* CLOSED */:
        if (this.failureCount > 0) {
          this.failureCount = 0;
        }
        break;
      case "HALF_OPEN" /* HALF_OPEN */:
        this.halfOpenSuccesses++;
        if (this.halfOpenSuccesses >= this.halfOpenMaxAttempts) {
          this.state = "CLOSED" /* CLOSED */;
          this.failureCount = 0;
          this.halfOpenSuccesses = 0;
          logger.info(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit CLOSED after ${this.halfOpenSuccesses} successful attempts`);
        }
        break;
      case "OPEN" /* OPEN */:
        break;
    }
  }
  /**
   * Record a failed request
   */
  recordFailure() {
    this.lastFailureTime = Date.now();
    switch (this.state) {
      case "CLOSED" /* CLOSED */:
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
          this.state = "OPEN" /* OPEN */;
          logger.error(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit OPENED after ${this.failureCount} failures`, new Error("Circuit opened"));
        }
        break;
      case "HALF_OPEN" /* HALF_OPEN */:
        this.state = "OPEN" /* OPEN */;
        logger.warn(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit OPENED from HALF_OPEN after failure`);
        break;
      case "OPEN" /* OPEN */:
        break;
    }
  }
  /**
   * Get current circuit state
   */
  getState() {
    return this.state;
  }
  /**
   * Get failure count
   */
  getFailureCount() {
    return this.failureCount;
  }
  /**
   * Check if circuit is open (failing fast)
   */
  isOpen() {
    return this.state === "OPEN" /* OPEN */;
  }
  /**
   * Check if circuit is closed (normal operation)
   */
  isClosed() {
    return this.state === "CLOSED" /* CLOSED */;
  }
  /**
   * Check if circuit is half-open (testing recovery)
   */
  isHalfOpen() {
    return this.state === "HALF_OPEN" /* HALF_OPEN */;
  }
  /**
   * Get time until next retry attempt (ms)
   */
  getTimeUntilRetry() {
    if (this.state !== "OPEN" /* OPEN */) {
      return 0;
    }
    const elapsed = Date.now() - this.lastFailureTime;
    return Math.max(0, this.resetTimeoutMs - elapsed);
  }
  /**
   * Force reset the circuit to closed state
   */
  reset() {
    this.state = "CLOSED" /* CLOSED */;
    this.failureCount = 0;
    this.halfOpenSuccesses = 0;
    this.lastFailureTime = 0;
    logger.info(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit manually reset to CLOSED`);
  }
  /**
   * Force open the circuit
   */
  trip() {
    this.state = "OPEN" /* OPEN */;
    this.lastFailureTime = Date.now();
    logger.warn(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit manually tripped to OPEN`);
  }
  /**
   * Get a status object for monitoring
   */
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      timeUntilRetry: this.getTimeUntilRetry(),
      halfOpenSuccesses: this.halfOpenSuccesses,
      halfOpenMaxAttempts: this.halfOpenMaxAttempts
    };
  }
};
var idpCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 3e4,
  halfOpenMaxAttempts: 3,
  name: "idp"
});
function createCircuitBreaker(options = {}) {
  return new CircuitBreaker(options);
}

// src/proxy.ts
async function fetchWithRetry(url, options = {}, maxAttempts = 4, baseDelayMs = 100, maxDelayMs = 5e3) {
  let lastError = null;
  let circuitRecorded = false;
  if (!idpCircuitBreaker.canExecute()) {
    const waitTime = idpCircuitBreaker.getTimeUntilRetry();
    logger.warn(`[SDK_CIRCUIT_BREAKER] Circuit is OPEN. Request blocked. Retry in ${waitTime}ms.`);
    return {
      ok: false,
      error: `Circuit breaker is open. IdP unavailable. Retry in ${Math.ceil(waitTime / 1e3)}s.`
    };
  }
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      try {
        await idpRateLimiter.waitForToken("idp");
      } catch (rateLimitErr) {
        const errMsg = rateLimitErr instanceof Error ? rateLimitErr.message : String(rateLimitErr);
        logger.error(`[SDK_RATE_LIMIT] Request blocked: ${errMsg}`, rateLimitErr);
        return { ok: false, error: `Rate limit exceeded: ${errMsg}` };
      }
      const res = await fetch(url, options);
      if (!res.ok && res.status >= 500) {
        lastError = new Error(`Server error: ${res.status}`);
        if (attempt < maxAttempts - 1) {
          const backoffDelay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
          const jitter = Math.random() * baseDelayMs * 0.5;
          const delay = Math.floor(backoffDelay + jitter);
          logger.warn(`[SDK_RETRY] Attempt ${attempt + 1} failed with ${res.status}. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        logger.error(`[SDK_RETRY] Final attempt (${attempt + 1}/${maxAttempts}) failed with ${res.status}`, lastError);
        if (!circuitRecorded) {
          idpCircuitBreaker.recordFailure();
          circuitRecorded = true;
        }
        return { ok: false, status: res.status, error: lastError.message };
      }
      if (res.ok && !circuitRecorded) {
        idpCircuitBreaker.recordSuccess();
        circuitRecorded = true;
      }
      const data = res.ok ? await res.json().catch(() => null) : null;
      return { ok: res.ok, data, status: res.status };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts - 1) {
        const backoffDelay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = Math.random() * baseDelayMs * 0.5;
        const delay = Math.floor(backoffDelay + jitter);
        logger.warn(`[SDK_RETRY] Attempt ${attempt + 1} failed with error: ${lastError.message}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  if (!circuitRecorded) {
    idpCircuitBreaker.recordFailure();
    circuitRecorded = true;
  }
  logger.error(`[SDK_RETRY] All ${maxAttempts} attempts failed. Last error`, lastError);
  return { ok: false, error: lastError?.message };
}
async function resolveTenant(subdomain, providerUrl) {
  try {
    const url = `${providerUrl}/api/auth/tenant/info?subdomain=${subdomain}`;
    const result = await fetchWithRetry(url, {
      next: { revalidate: 60 }
    }, 3, 100);
    if (result.ok && result.data) {
      return TenantInfoSchema.parse(result.data);
    }
  } catch (err) {
    logger.error("[SDK_TENANT_RESOLVE_ERROR] Failed to resolve tenant", err);
  }
  return null;
}
var debugLog = (msg, meta) => {
  if (process.env.NODE_ENV !== "production") {
    logger.debug(msg, meta);
  }
};
async function verifySessionExpiry(email, sessionId, tokenIat, requestUrl, providerUrl, clientSecret) {
  try {
    const verifyUrl = new URL(`${providerUrl}/api/auth/session/verify`, requestUrl);
    verifyUrl.searchParams.set("email", email);
    if (sessionId) {
      verifyUrl.searchParams.set("sessionId", sessionId);
    }
    const result = await fetchWithRetry(verifyUrl.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${clientSecret}`,
        "Content-Type": "application/json"
      },
      next: { revalidate: 0 }
    }, 3, 100);
    if (result.ok && result.data) {
      const parsed = SessionVerifySchema.parse(result.data);
      return parsed.active;
    } else {
      const isWithin24h = Date.now() / 1e3 - tokenIat < 86400;
      const status = result.status || 0;
      logger.warn(`[SDK_SESSION_VERIFY_WARNING] Central IdP returned status ${status}. Fallback (24h rule): ${isWithin24h}`);
      return isWithin24h;
    }
  } catch (err) {
    const isWithin24h = Date.now() / 1e3 - tokenIat < 86400;
    logger.error("[SDK_SESSION_VERIFY_ERROR] Failed to contact Central IdP. Fallback (24h rule):", err);
    return isWithin24h;
  }
}
function withIndustrialAuth(options) {
  const providerUrl = options.authProviderUrl || process.env.AUTH_PROVIDER_URL || "https://abd-auth.vercel.app";
  const clientSecret = options.clientSecret || process.env.AUTH_CLIENT_SECRET || "";
  const jwtSecret = options.jwtSecret || process.env.AUTH_JWT_SECRET || "";
  const cookieName = options.cookieName || "abd_session";
  const verifiedCookieName = options.verifiedCookieName || "abd_session_verified";
  const publicPaths = options.publicPaths || ["/", "/logout-success"];
  return async function middleware(request) {
    const { pathname } = request.nextUrl;
    const isAsset = pathname.includes(".") || pathname.startsWith("/_next") || pathname.startsWith("/api/") || pathname === "/favicon.ico";
    if (isAsset) {
      return options.intlMiddleware ? options.intlMiddleware(request) : NextResponse.next();
    }
    const host = request.headers.get("host");
    const subdomain = getTenantSubdomain(host);
    let tenantInfo = null;
    if (subdomain) {
      tenantInfo = await resolveTenant(subdomain, providerUrl);
      if (!tenantInfo || !tenantInfo.active) {
        const baseAppUrl = options.baseAppUrl || process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
        debugLog(`[SDK_PROXY] [${options.appId}] Tenant inactive or not found: ${subdomain}`);
        return NextResponse.redirect(new URL(`${baseAppUrl}/logout-success?error=tenant_not_found`));
      }
    }
    const getUnlocalizedPath = (path) => {
      const parts = path.split("/");
      if (parts.length > 1 && parts[1].length === 2) {
        return "/" + parts.slice(2).join("/");
      }
      return path;
    };
    const unlocalizedPath = getUnlocalizedPath(pathname);
    const isPublic = publicPaths.some((p) => {
      const normalizedPath = unlocalizedPath.replace(/\/$/, "") || "/";
      const normalizedParam = p.replace(/\/$/, "") || "/";
      if (normalizedParam === "/") {
        return normalizedPath === "/";
      }
      return normalizedPath === normalizedParam || normalizedPath.startsWith(normalizedParam + "/");
    });
    const sessionCookie = request.cookies.get(cookieName);
    debugLog(`[SDK_PROXY] [${options.appId}] Session cookie '${cookieName}': ${sessionCookie?.value ? "PRESENT" : "MISSING"}`);
    let isAuthenticated = false;
    let isAppNotAllowed = false;
    let didVerifyThisRequest = false;
    let userEmail = "";
    let userRole = "";
    let userTenantId = "";
    let userSessionId = "";
    let userTokenIat = 0;
    if (sessionCookie?.value) {
      debugLog(`[SDK_PROXY] [${options.appId}] Verifying token using secret prefix: ${jwtSecret ? jwtSecret.substring(0, 10) + "..." : "undefined"}`);
      const payload = await verifyToken(sessionCookie.value, jwtSecret);
      if (payload) {
        debugLog(`[SDK_PROXY] [${options.appId}] Token verified for tenant: ${payload.tenantId}`);
        isAuthenticated = true;
        userEmail = payload.email;
        userRole = payload.role;
        userTenantId = payload.tenantId;
        userSessionId = payload.sessionId || "";
        userTokenIat = payload.iat || Math.floor(Date.now() / 1e3);
        if (payload.allowedApps && userRole !== "SUPER_ADMIN") {
          if (!payload.allowedApps.includes(options.appId)) {
            debugLog(`[SDK_AUTH_BLOCKED] User allowedApps does not include '${options.appId}'`);
            isAuthenticated = false;
            isAppNotAllowed = true;
          }
        }
      } else {
        debugLog(`[SDK_PROXY] [${options.appId}] Token verification failed (returned null)`);
      }
    }
    if (isAuthenticated && tenantInfo && userTenantId !== tenantInfo.tenantId) {
      debugLog(`[SDK_CROSS_TENANT_SECURITY_BLOCKED] User tenant '${userTenantId}' does not match host tenant '${tenantInfo.tenantId}'`);
      isAuthenticated = false;
    }
    if (isAuthenticated && tenantInfo && tenantInfo.allowedApps && userRole !== "SUPER_ADMIN") {
      if (!tenantInfo.allowedApps.includes(options.appId)) {
        debugLog(`[SDK_TENANT_BLOCKED] Tenant '${tenantInfo.tenantId}' allowedApps does not include '${options.appId}'`);
        isAuthenticated = false;
        isAppNotAllowed = true;
      }
    }
    if (isAuthenticated && sessionCookie && userEmail) {
      const verifiedCookie = request.cookies.get(verifiedCookieName);
      debugLog(`[SDK_PROXY] [${options.appId}] Verified cookie '${verifiedCookieName}': ${verifiedCookie?.value ? "PRESENT" : "MISSING"}`);
      if (!verifiedCookie) {
        debugLog(`[SDK_PROXY] [${options.appId}] Contacting IdP to verify session expiry.`);
        const isSessionActive = await verifySessionExpiry(userEmail, userSessionId, userTokenIat, request.url, providerUrl, clientSecret);
        debugLog(`[SDK_PROXY] [${options.appId}] Central session active: ${isSessionActive}`);
        if (isSessionActive) {
          didVerifyThisRequest = true;
        } else {
          debugLog(`[SDK_SESSION_EXPIRED] User session is inactive at central IdP`);
          isAuthenticated = false;
        }
      }
    }
    if (isPublic && !isAuthenticated) {
      debugLog(`[SDK_PROXY] [${options.appId}] Unauthenticated request to public path '${pathname}'. Bypassing.`);
      return options.intlMiddleware ? options.intlMiddleware(request) : NextResponse.next();
    }
    if (!isAuthenticated) {
      const currentUrl = new URL(request.url);
      const dynamicAppUrl = `${currentUrl.protocol}//${currentUrl.host}`;
      const authorizeUrl = new URL(`${providerUrl}/api/auth/federated/authorize`, request.url);
      authorizeUrl.searchParams.set("client_id", options.clientId);
      authorizeUrl.searchParams.set("redirect_uri", `${dynamicAppUrl}/api/auth/federated/callback`);
      authorizeUrl.searchParams.set("state", pathname);
      if (isAppNotAllowed) {
        authorizeUrl.searchParams.set("error", "app_not_allowed");
      }
      if (tenantInfo) {
        authorizeUrl.searchParams.set("tenant", tenantInfo.tenantId);
      }
      debugLog(`[SDK_PROXY] [${options.appId}] Redirecting unauthorized user to IdP.`);
      const response2 = NextResponse.redirect(authorizeUrl);
      response2.cookies.set(cookieName, "", { path: "/", maxAge: 0, expires: /* @__PURE__ */ new Date(0) });
      response2.cookies.set(verifiedCookieName, "", { path: "/", maxAge: 0, expires: /* @__PURE__ */ new Date(0) });
      return response2;
    }
    const response = options.intlMiddleware ? await options.intlMiddleware(request) : NextResponse.next();
    if (didVerifyThisRequest) {
      response.cookies.set(verifiedCookieName, "1", {
        path: "/",
        maxAge: 60,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
      });
    }
    return response;
  };
}

// src/session.ts
import { cookies } from "next/headers";
var UnauthorizedAccessError = class extends Error {
  constructor(message = "UNAUTHORIZED_ECOSYSTEM_ACCESS") {
    super(message);
    this.name = "UnauthorizedAccessError";
  }
};
var InsufficientPrivilegesError = class extends Error {
  constructor(message = "INSUFFICIENT_INDUSTRIAL_PRIVILEGES") {
    super(message);
    this.name = "InsufficientPrivilegesError";
  }
};
async function getIndustrialSession(customSecret) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("abd_session");
    if (!sessionCookie?.value) {
      return { authenticated: false };
    }
    const payload = await verifyToken(sessionCookie.value, customSecret);
    if (!payload) {
      return { authenticated: false };
    }
    const parsedPayload = FederatedSessionSchema.safeParse({
      authenticated: true,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        surname: payload.surname,
        role: payload.role,
        tenantId: payload.tenantId,
        dbPrefix: payload.dbPrefix,
        isolationStrategy: payload.isolationStrategy,
        permissions: payload.permissions,
        allowedApps: payload.allowedApps,
        sessionId: payload.sessionId
      }
    });
    if (!parsedPayload.success) {
      if (process.env.NODE_ENV !== "production") {
        logger.error("[SDK_GET_SESSION_ERROR] Payload validation failed", parsedPayload.error);
      }
      return { authenticated: false };
    }
    return parsedPayload.data;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[SDK_GET_SESSION_ERROR] Failed to retrieve industrial session:", error instanceof Error ? error.message : error);
    }
    return { authenticated: false };
  }
}
async function ensureIndustrialAccess(requiredRole, customSecret) {
  const session = await getIndustrialSession(customSecret);
  if (!session.authenticated || !session.user) {
    throw new UnauthorizedAccessError();
  }
  if (requiredRole && session.user.role !== requiredRole && session.user.role !== "SUPER_ADMIN") {
    throw new InsufficientPrivilegesError();
  }
  return session.user;
}

// src/styles/BrandingStyles.tsx
import { headers } from "next/headers";
import { generateTenantCss } from "@abd/styles";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
async function BrandingStyles({
  authProviderUrl,
  revalidateSeconds = 3600
}) {
  try {
    const headersList = await headers();
    const host = headersList.get("host");
    const subdomain = getTenantSubdomain(host);
    if (!subdomain) return null;
    const providerUrl = authProviderUrl || process.env.AUTH_PROVIDER_URL || "https://abd-auth.vercel.app";
    const verifyTenantUrl = `${providerUrl}/api/auth/tenant/info?subdomain=${subdomain}`;
    const res = await fetch(verifyTenantUrl, {
      next: { revalidate: revalidateSeconds }
    });
    if (!res.ok) {
      return null;
    }
    const rawData = await res.json();
    const data = TenantInfoSchema.parse(rawData);
    const branding = data.branding;
    const customCss = branding?.theme ? generateTenantCss(branding.theme) : null;
    const faviconUrl = branding?.favicon?.url || null;
    if (!customCss && !faviconUrl) {
      return null;
    }
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      customCss && /* @__PURE__ */ jsx(
        "style",
        {
          id: "tenant-branding-gateway",
          dangerouslySetInnerHTML: { __html: customCss }
        }
      ),
      faviconUrl && /* @__PURE__ */ jsx("link", { rel: "icon", href: faviconUrl })
    ] });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[SDK_BRANDING_STYLES_ERROR] Failed to inject dynamic styling", err);
    }
  }
  return null;
}

// src/routeHandler.ts
import { NextResponse as NextResponse2 } from "next/server";
function createAuthRouteHandler(options) {
  const providerUrl = options.authProviderUrl || process.env.AUTH_PROVIDER_URL || "https://abd-auth.vercel.app";
  const clientId = options.clientId;
  const clientSecret = options.clientSecret || process.env.AUTH_CLIENT_SECRET || "";
  const cookieName = options.cookieName || "abd_session";
  const verifiedCookieName = options.verifiedCookieName || "abd_session_verified";
  return async function handler(request) {
    const { pathname, searchParams } = new URL(request.url);
    if (pathname.endsWith("/session")) {
      const session = await getIndustrialSession(options.jwtSecret);
      return NextResponse2.json(session);
    }
    if (pathname.endsWith("/logout")) {
      const isSilent = searchParams.get("silent") === "true";
      const clearCookieConfig = {
        path: "/",
        maxAge: 0,
        expires: /* @__PURE__ */ new Date(0),
        httpOnly: true
      };
      if (isSilent) {
        const response2 = new NextResponse2(null, { status: 200 });
        response2.cookies.set(cookieName, "", clearCookieConfig);
        response2.cookies.set(verifiedCookieName, "", clearCookieConfig);
        response2.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        response2.headers.set("Pragma", "no-cache");
        response2.headers.set("Expires", "0");
        return response2;
      }
      const appUrl = options.baseAppUrl || process.env.NEXT_PUBLIC_APP_URL || `${new URL(request.url).protocol}//${new URL(request.url).host}`;
      const redirectUri = `${appUrl}/logout-success`;
      const providerLogoutUrl = `${providerUrl}/api/auth/logout`;
      const response = NextResponse2.redirect(
        new URL(`${providerLogoutUrl}?redirect_uri=${encodeURIComponent(redirectUri)}`)
      );
      response.cookies.set(cookieName, "", clearCookieConfig);
      response.cookies.set(verifiedCookieName, "", clearCookieConfig);
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
      return response;
    }
    if (pathname.endsWith("/federated/callback")) {
      const code = searchParams.get("code");
      const state = searchParams.get("state") || "/";
      if (!code || !/^[A-Za-z0-9_-]{10,256}$/.test(code)) {
        return NextResponse2.json({ error: "Invalid or missing authorization code" }, { status: 400 });
      }
      try {
        const tokenUrl = `${providerUrl}/api/auth/federated/token`;
        const currentUrl = new URL(request.url);
        const dynamicRedirectUri = `${currentUrl.protocol}//${currentUrl.host}/api/auth/federated/callback`;
        const res = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: dynamicRedirectUri
          })
        });
        if (!res.ok) {
          const errorData = await res.json();
          return NextResponse2.json({ error: "Token exchange failed", detail: errorData }, { status: 401 });
        }
        const rawData = await res.json();
        const data = TokenResponseSchema.parse(rawData);
        const redirectResponse = NextResponse2.redirect(new URL(state, request.url));
        redirectResponse.cookies.set(cookieName, data.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 8
          // 8-hour industrial shift
        });
        return redirectResponse;
      } catch (err) {
        logger.error("[SDK_CALLBACK_EXCHANGE_ERROR] Token exchange failed", err);
        return NextResponse2.json({ error: "Internal server error during token exchange" }, { status: 500 });
      }
    }
    return NextResponse2.json({ error: "Route not found" }, { status: 404 });
  };
}

// src/db/tenant-context.ts
import { AsyncLocalStorage } from "async_hooks";
var tenantStorage = new AsyncLocalStorage();

// src/db/tenant-connection.ts
import mongoose from "mongoose";
var globalWithTenantConnections = global;
if (!globalWithTenantConnections.tenantConnections) {
  globalWithTenantConnections.tenantConnections = {};
}
var connectionPool = globalWithTenantConnections.tenantConnections;
function resolveTenantUri(baseUri, dbName) {
  const protocolMatch = baseUri.match(/^mongodb(?:\+srv)?:\/\//);
  if (!protocolMatch) {
    throw new Error("Invalid MONGODB_URI protocol");
  }
  const protocol = protocolMatch[0];
  const remaining = baseUri.substring(protocol.length);
  const qIndex = remaining.indexOf("?");
  const hostAndDb = qIndex === -1 ? remaining : remaining.substring(0, qIndex);
  const options = qIndex === -1 ? "" : remaining.substring(qIndex);
  const slashIndex = hostAndDb.lastIndexOf("/");
  if (slashIndex === -1) {
    return `${protocol}${hostAndDb}/${dbName}${options}`;
  } else {
    const hostPart = hostAndDb.substring(0, slashIndex);
    return `${protocol}${hostPart}/${dbName}${options}`;
  }
}
function getTenantConnection(dbPrefix, isolationStrategy) {
  const cacheKey = isolationStrategy === "DATABASE_PER_TENANT" ? `DB_PER_TENANT:${dbPrefix}` : `COLL_PREFIX:${dbPrefix}`;
  if (connectionPool[cacheKey]) {
    connectionPool[cacheKey].lastUsed = Date.now();
    return connectionPool[cacheKey].connection;
  }
  const keys = Object.keys(connectionPool);
  if (keys.length >= 15) {
    let oldestKey = "";
    let oldestTime = Infinity;
    for (const key of keys) {
      if (connectionPool[key].lastUsed < oldestTime) {
        oldestTime = connectionPool[key].lastUsed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const evicted = connectionPool[oldestKey];
      delete connectionPool[oldestKey];
      if (process.env.NODE_ENV !== "production") {
        console.log(`[MultiTenant] Evicting LRU connection from cache: ${oldestKey}`);
      }
      evicted.connection.close().catch((err) => {
        console.error(`[MultiTenant] Error closing evicted connection ${oldestKey}:`, err);
      });
    }
  }
  const baseUri = process.env.MONGODB_URI || "";
  if (!baseUri) {
    throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
  }
  let targetUri = baseUri;
  if (isolationStrategy === "DATABASE_PER_TENANT") {
    const dbName = `abd_tenant_${dbPrefix}`;
    targetUri = resolveTenantUri(baseUri, dbName);
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(`[MultiTenant] Creating connection for ${cacheKey} (Strategy: ${isolationStrategy})`);
  }
  const opts = {
    bufferCommands: false,
    maxPoolSize: 3,
    serverSelectionTimeoutMS: 5e3,
    socketTimeoutMS: 45e3
  };
  const conn = mongoose.createConnection(targetUri, opts);
  conn.on("connected", () => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[MultiTenant] Connection established for ${cacheKey}`);
    }
  });
  conn.on("error", (err) => {
    console.error(`[MultiTenant] Connection error for ${cacheKey}:`, err);
  });
  connectionPool[cacheKey] = {
    connection: conn,
    lastUsed: Date.now()
  };
  return conn;
}
async function ensureConnectionReady(conn) {
  if (conn.readyState === 1) {
    return conn;
  }
  if (conn.readyState === 2) {
    await new Promise((resolve, reject) => {
      const onConnected = () => {
        conn.removeListener("error", onError);
        resolve();
      };
      const onError = (err) => {
        conn.removeListener("connected", onConnected);
        reject(err);
      };
      conn.once("connected", onConnected);
      conn.once("error", onError);
    });
    return conn;
  }
  await conn.asPromise();
  return conn;
}

// src/db/tenant-model.ts
import mongoose2 from "mongoose";
async function withTenantContext(callback, explicitContext) {
  const activeStore = tenantStorage.getStore();
  if (activeStore) {
    const conn = getTenantConnection(activeStore.dbPrefix, activeStore.isolationStrategy);
    await ensureConnectionReady(conn);
    return callback();
  }
  if (explicitContext) {
    const conn = getTenantConnection(explicitContext.dbPrefix, explicitContext.isolationStrategy);
    await ensureConnectionReady(conn);
    return tenantStorage.run(explicitContext, callback);
  }
  try {
    const session = await getIndustrialSession();
    if (session?.authenticated && session.user?.tenantId) {
      const dbPrefix = session.user.dbPrefix || session.user.tenantId.toLowerCase().replace(/[^a-z0-9]/g, "");
      const context = {
        tenantId: session.user.tenantId,
        dbPrefix,
        isolationStrategy: session.user.isolationStrategy || "COLLECTION_PREFIX"
      };
      const conn = getTenantConnection(context.dbPrefix, context.isolationStrategy);
      await ensureConnectionReady(conn);
      return tenantStorage.run(context, callback);
    }
  } catch (err) {
    console.warn("[TenantContext] Failed to get session or cookies:", err);
  }
  return callback();
}
function compileModelOnConnection(conn, modelName, schema, collectionName) {
  if (conn.models[modelName]) {
    return conn.models[modelName];
  }
  return conn.model(modelName, schema, collectionName);
}
function getModelForTenant(dbPrefix, isolationStrategy, modelName, schema, defaultCollectionName) {
  const conn = getTenantConnection(dbPrefix, isolationStrategy);
  let collectionName = defaultCollectionName;
  if (isolationStrategy === "COLLECTION_PREFIX") {
    collectionName = `${dbPrefix}_${defaultCollectionName}`;
  }
  return compileModelOnConnection(conn, modelName, schema, collectionName);
}
function getTenantModel(modelName, schema) {
  const defaultModel = mongoose2.models[modelName] || mongoose2.model(modelName, schema);
  const defaultCollectionName = defaultModel.collection.name;
  return new Proxy(defaultModel, {
    get(target, prop, receiver) {
      const store = tenantStorage.getStore();
      if (!store) {
        return Reflect.get(target, prop, receiver);
      }
      const tenantModel = getModelForTenant(
        store.dbPrefix,
        store.isolationStrategy,
        modelName,
        schema,
        defaultCollectionName
      );
      const value = Reflect.get(tenantModel, prop);
      if (typeof value === "function") {
        return value.bind(tenantModel);
      }
      return value;
    },
    construct(target, args, newTarget) {
      const store = tenantStorage.getStore();
      if (!store) {
        return Reflect.construct(target, args, newTarget);
      }
      const tenantModel = getModelForTenant(
        store.dbPrefix,
        store.isolationStrategy,
        modelName,
        schema,
        defaultCollectionName
      );
      return Reflect.construct(tenantModel, args, newTarget);
    }
  });
}

// src/utils/cloudinary.ts
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
async function uploadBrandingAsset(buffer, _filename, tenantId, assetType) {
  return new Promise((resolve, reject) => {
    const baseFolder = process.env.CLOUDINARY_BASE_FOLDER || "abd-tenants";
    const folder = `${baseFolder}/tenants/${tenantId}/branding`;
    const publicId = `${assetType}_${Date.now()}`;
    const transformation = assetType === "logo" ? [{ width: 800, height: 400, crop: "limit" }, { quality: "auto", fetch_format: "auto" }] : [{ width: 64, height: 64, crop: "fill" }, { quality: "auto", fetch_format: "auto" }];
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder,
        public_id: publicId,
        transformation
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.url,
            publicId: result.public_id,
            secureUrl: result.secure_url
          });
        } else {
          reject(new Error("Cloudinary upload failed with no response"));
        }
      }
    );
    uploadStream.end(buffer);
  });
}
async function deleteCloudinaryAsset(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    console.error(`[CLOUDINARY_DELETE_ERROR] Failed to destroy asset ${publicId}:`, err);
  }
}

// src/utils/crypto-chain.ts
import crypto from "crypto";
import stringify from "fast-json-stable-stringify";
function computeBlockHash(payload, previousHash, timestamp) {
  const payloadString = stringify(payload);
  const entropy = timestamp ? `${previousHash}${payloadString}${timestamp}` : `${previousHash}${payloadString}`;
  return crypto.createHash("sha256").update(entropy).digest("hex");
}

// src/utils/tenant-branding.ts
async function resolveTenantBranding() {
  try {
    const { headers: headers2 } = await import("next/headers");
    const headersList = await headers2();
    const host = headersList.get("host");
    const subdomain = getTenantSubdomain(host);
    if (!subdomain) return null;
    const providerUrl = process.env.AUTH_PROVIDER_URL || "https://abd-auth.vercel.app";
    const verifyTenantUrl = `${providerUrl}/api/auth/tenant/info?subdomain=${subdomain}`;
    const res = await fetch(verifyTenantUrl, {
      next: { revalidate: 3600 }
    });
    if (!res.ok) return null;
    const rawData = await res.json();
    const data = TenantInfoSchema.parse(rawData);
    return data.branding || null;
  } catch {
    return null;
  }
}

// src/utils/mongodb.ts
import mongoose3 from "mongoose";
var globalWithMongoose = global;
var cached = globalWithMongoose.__mongoose || { conn: null, promise: null };
if (!globalWithMongoose.__mongoose) {
  globalWithMongoose.__mongoose = cached;
}
async function connectDB(serviceName) {
  const MONGODB_URI = process.env.MONGODB_URI || "";
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
  }
  if (cached.conn) {
    return cached.conn;
  }
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5e3,
      socketTimeoutMS: 45e3
    };
    cached.promise = mongoose3.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      const name = serviceName || process.env.NEXT_PUBLIC_APP_ID || "satellite-app";
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] ${name} MongoDB connected to Cluster`);
      }
      return mongooseInstance;
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  const store = tenantStorage.getStore();
  if (store) {
    try {
      const tenantConn = getTenantConnection(store.dbPrefix, store.isolationStrategy);
      await ensureConnectionReady(tenantConn);
    } catch (e) {
      console.error(`[MultiTenant] Failed to connect to tenant database for ${store.dbPrefix}:`, e);
      throw e;
    }
  }
  return cached.conn;
}
var mongodb_default = connectDB;
export {
  BrandingStyles,
  CircuitBreaker,
  CircuitState,
  FederatedSessionSchema,
  InsufficientPrivilegesError,
  QuizEntityType,
  QuizEventAction,
  RateLimiter,
  SessionVerifySchema,
  TenantInfoSchema,
  TokenResponseSchema,
  UnauthorizedAccessError,
  VerifiedTokenPayloadSchema,
  computeBlockHash,
  configureLogger,
  mongodb_default as connectDB,
  createAuthRouteHandler,
  createCircuitBreaker,
  createRateLimiter,
  mongodb_default as default,
  deleteCloudinaryAsset,
  ensureConnectionReady,
  ensureIndustrialAccess,
  fetchWithRetry,
  getIndustrialSession,
  getTenantConnection,
  getTenantModel,
  getTenantSubdomain,
  idpCircuitBreaker,
  idpRateLimiter,
  logger,
  redactPII,
  resolveTenantBranding,
  resolveTenantUri,
  tenantStorage,
  uploadBrandingAsset,
  verifyToken,
  withIndustrialAuth,
  withTenantContext
};
//# sourceMappingURL=index.mjs.map