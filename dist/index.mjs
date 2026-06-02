import {
  FederatedSessionSchema,
  SessionVerifySchema,
  TenantInfoSchema,
  TokenResponseSchema,
  VerifiedTokenPayloadSchema
} from "./chunk-4XMRWPPS.mjs";

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

// src/logger/redact-pii.ts
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

// src/logger/types.ts
var LEVEL_VALUES = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// src/logger/offline-buffer.ts
var BUFFER_KEY = "abd_logger_buffer";
var MAX_BUFFER_SIZE = 100;
var MAX_RETRIES = 5;
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
async function flushBuffer(endpoint, token, appId) {
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
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token || "dev-bypass-token"}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...entry.payload,
          appId,
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
function clearBuffer() {
  saveBuffer([]);
}

// src/logger/index.ts
var globalConfig = { endpoint: process.env.LOGS_SERVICE_URL || "http://localhost:3600/api/logs", token: process.env.LOGS_SECRET_TOKEN, appId: process.env.NEXT_PUBLIC_APP_ID || "satellite-app", minLevel: process.env.LOG_LEVEL || "INFO" };
var connectionStatus = "unknown";
var subscribers = /* @__PURE__ */ new Set();
function logToConsole(level, message, meta) {
  const minConfigLevel = globalConfig.minLevel || "INFO";
  if (LEVEL_VALUES[level] < LEVEL_VALUES[minConfigLevel]) return;
  const logObject = { timestamp: (/* @__PURE__ */ new Date()).toISOString(), level, appId: globalConfig.appId, message: redactPII(message), meta: meta ? redactPII(meta) : void 0 };
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
    const msg = errorOrMessage instanceof Error ? errorOrMessage.message : String(errorOrMessage);
    logToConsole("ERROR", msg, errorOrMessage instanceof Error ? { ...meta || {}, stack: errorOrMessage.stack, name: errorOrMessage.name } : meta);
  },
  async audit(payload) {
    const { endpoint, token, appId } = globalConfig;
    const redactedPayload = { ...payload, appId: appId || payload.appId || "unknown", changedFields: payload.changedFields ? redactPII(payload.changedFields) : {}, previousState: payload.previousState ? redactPII(payload.previousState) : void 0 };
    logToConsole("INFO", `[AUDIT_EVENT][${redactedPayload.action}] entityType=${redactedPayload.entityType}`, { action: redactedPayload.action, entityType: redactedPayload.entityType, entityId: redactedPayload.entityId, userId: redactedPayload.userId, userEmail: redactedPayload.userEmail });
    const isBrowser = typeof window !== "undefined";
    if (isBrowser && getBuffer().length > 0) flushBuffer(endpoint, token, appId).catch(() => {
    });
    if (!token && process.env.NODE_ENV === "production") {
      console.error("[LOGGER_AUDIT_WARNING] LOGS_SECRET_TOKEN is missing in production.");
      return;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1e4);
      const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token || "dev-bypass-token"}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...redactedPayload, createdAt: /* @__PURE__ */ new Date() }), signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`ABDLogs responded with HTTP ${response.status}`);
      connectionStatus = "connected";
      notifySubscribers("connected");
      if (isBrowser) flushBuffer(endpoint, token, appId).catch(() => {
      });
    } catch (error) {
      const message = error instanceof Error ? error.name === "AbortError" ? "Request timeout (10s)" : error.message : "Unknown error";
      if (isBrowser) {
        addToBuffer(payload);
        connectionStatus = "disconnected";
        notifySubscribers("disconnected");
      } else console.warn(`[Logger] \u26A0\uFE0F Failed to send audit log (server-side): ${message}`);
    }
  },
  async checkConnection() {
    const healthUrl = `${getBaseUrl()}/api/logs/health`;
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5e3);
      const response = await fetch(healthUrl, { method: "GET", signal: controller.signal, cache: "no-store" });
      clearTimeout(timeout);
      const latency = Date.now() - start;
      if (!response.ok) throw new Error(`Health check responded with HTTP ${response.status}`);
      connectionStatus = "connected";
      notifySubscribers("connected");
      return { connected: true, latency };
    } catch (error) {
      connectionStatus = "disconnected";
      notifySubscribers("disconnected");
      return { connected: false, latency: Date.now() - start, error: error instanceof Error ? error.name === "AbortError" ? "Connection timeout (5s)" : error.message : "Unknown error" };
    }
  },
  getConnectionStatus() {
    return connectionStatus;
  },
  onConnectionChange(callback) {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  },
  getBufferSize() {
    return getBuffer().length;
  },
  async flushBuffer() {
    return flushBuffer(globalConfig.endpoint, globalConfig.token, globalConfig.appId);
  },
  clearBuffer() {
    clearBuffer();
  },
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
  maxTokens;
  minDelayMs;
  constructor(options = {}) {
    const { requestsPerSecond = 10, burstSize = 20, minDelayMs = 50 } = options;
    this.refillRate = requestsPerSecond / 1e3;
    this.maxTokens = burstSize;
    this.minDelayMs = minDelayMs;
  }
  tryAcquire(key = "global") {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    }
    const timePassed = now - bucket.lastRefill;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + timePassed * this.refillRate);
    bucket.lastRefill = now;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    const waitTimeMs = Math.ceil((1 - bucket.tokens) / this.refillRate);
    logger.warn(`[SDK_RATE_LIMIT] Request blocked for key '${key}'. Wait ${waitTimeMs}ms. Tokens: ${bucket.tokens.toFixed(2)}`);
    return false;
  }
  async waitForToken(key = "global", maxWaitMs = 5e3) {
    const startTime = Date.now();
    while (!this.tryAcquire(key)) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= maxWaitMs) {
        logger.error(`[SDK_RATE_LIMIT] Wait timeout after ${maxWaitMs}ms for key '${key}'`, new Error("Rate limit timeout"));
        throw new Error(`Rate limit wait timeout after ${maxWaitMs}ms for key '${key}'`);
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(this.minDelayMs, maxWaitMs - elapsed)));
    }
  }
  async execute(key, fn) {
    await this.waitForToken(key);
    return fn();
  }
  getTokens(key = "global") {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.maxTokens;
    return Math.min(this.maxTokens, bucket.tokens + (Date.now() - bucket.lastRefill) * this.refillRate);
  }
  reset(key) {
    key ? this.buckets.delete(key) : this.buckets.clear();
  }
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

// src/utils/circuitBreakerTypes.ts
var CircuitState = /* @__PURE__ */ ((CircuitState2) => {
  CircuitState2["CLOSED"] = "CLOSED";
  CircuitState2["OPEN"] = "OPEN";
  CircuitState2["HALF_OPEN"] = "HALF_OPEN";
  return CircuitState2;
})(CircuitState || {});

// src/utils/createCircuitBreaker.ts
function createCircuitBreaker(options = {}) {
  return new CircuitBreaker(options);
}

// src/utils/circuitBreaker.ts
var CircuitBreaker = class {
  state = "CLOSED" /* CLOSED */;
  failureCount = 0;
  lastFailureTime = 0;
  halfOpenSuccesses = 0;
  failureThreshold;
  resetTimeoutMs;
  halfOpenMaxAttempts;
  name;
  constructor(options = {}) {
    const { failureThreshold = 5, resetTimeoutMs = 3e4, halfOpenMaxAttempts = 3, name = "idp" } = options;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.halfOpenMaxAttempts = halfOpenMaxAttempts;
    this.name = name;
  }
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
  recordSuccess() {
    switch (this.state) {
      case "CLOSED" /* CLOSED */:
        if (this.failureCount > 0) this.failureCount = 0;
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
  getState() {
    return this.state;
  }
  getFailureCount() {
    return this.failureCount;
  }
  isOpen() {
    return this.state === "OPEN" /* OPEN */;
  }
  isClosed() {
    return this.state === "CLOSED" /* CLOSED */;
  }
  isHalfOpen() {
    return this.state === "HALF_OPEN" /* HALF_OPEN */;
  }
  getTimeUntilRetry() {
    if (this.state !== "OPEN" /* OPEN */) return 0;
    return Math.max(0, this.resetTimeoutMs - (Date.now() - this.lastFailureTime));
  }
  reset() {
    this.state = "CLOSED" /* CLOSED */;
    this.failureCount = 0;
    this.halfOpenSuccesses = 0;
    this.lastFailureTime = 0;
    logger.info(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit manually reset to CLOSED`);
  }
  trip() {
    this.state = "OPEN" /* OPEN */;
    this.lastFailureTime = Date.now();
    logger.warn(`[SDK_CIRCUIT_BREAKER] [${this.name}] Circuit manually tripped to OPEN`);
  }
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
var idpCircuitBreaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 3e4, halfOpenMaxAttempts: 3, name: "idp" });

// src/utils/fetch-with-retry.ts
async function fetchWithRetry(url, options = {}, maxAttempts = 4, baseDelayMs = 100, maxDelayMs = 5e3) {
  let lastError = null;
  let circuitRecorded = false;
  if (!idpCircuitBreaker.canExecute()) {
    const waitTime = idpCircuitBreaker.getTimeUntilRetry();
    logger.warn(`[SDK_CIRCUIT_BREAKER] Circuit is OPEN. Request blocked. Retry in ${waitTime}ms.`);
    return { ok: false, error: `Circuit breaker is open. IdP unavailable. Retry in ${Math.ceil(waitTime / 1e3)}s.` };
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

// src/utils/idp-resolver.ts
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
async function verifySessionExpiry(email, sessionId, tokenIat, requestUrl, providerUrl, clientSecret) {
  try {
    const verifyUrl = new URL(`${providerUrl}/api/auth/session/verify`, requestUrl);
    verifyUrl.searchParams.set("email", email);
    if (sessionId) verifyUrl.searchParams.set("sessionId", sessionId);
    const result = await fetchWithRetry(verifyUrl.toString(), {
      method: "GET",
      headers: { "Authorization": `Bearer ${clientSecret}`, "Content-Type": "application/json" },
      next: { revalidate: 0 }
    }, 3, 100);
    if (result.ok && result.data) {
      const parsed = SessionVerifySchema.parse(result.data);
      return parsed.active;
    } else {
      const isWithin24h = Date.now() / 1e3 - tokenIat < 86400;
      logger.warn(`[SDK_SESSION_VERIFY_WARNING] Central IdP returned status ${result.status || 0}. Fallback (24h rule): ${isWithin24h}`);
      return isWithin24h;
    }
  } catch (err) {
    const isWithin24h = Date.now() / 1e3 - tokenIat < 86400;
    logger.error("[SDK_SESSION_VERIFY_ERROR] Failed to contact Central IdP. Fallback (24h rule):", err);
    return isWithin24h;
  }
}

// src/proxy.ts
var debugLog = (msg, meta) => {
  if (process.env.NODE_ENV !== "production") logger.debug(msg, meta);
};
function withIndustrialAuth(options) {
  const providerUrl = options.authProviderUrl || process.env.AUTH_PROVIDER_URL || "https://abd-auth.vercel.app";
  const clientSecret = options.clientSecret || process.env.AUTH_CLIENT_SECRET || "";
  const jwtSecret = options.jwtSecret || process.env.AUTH_JWT_SECRET;
  if (!jwtSecret) throw new Error("[SDK] AUTH_JWT_SECRET is required for JWT verification.");
  const cookieName = options.cookieName || "abd_session";
  const verifiedCookieName = options.verifiedCookieName || "abd_session_verified";
  const publicPaths = options.publicPaths || ["/", "/logout-success"];
  return async function middleware(request) {
    const { pathname } = request.nextUrl;
    if (pathname.includes(".") || pathname.startsWith("/_next") || pathname.startsWith("/api/") || pathname === "/favicon.ico")
      return options.intlMiddleware ? options.intlMiddleware(request) : NextResponse.next();
    const host = request.headers.get("host");
    const subdomain = getTenantSubdomain(host);
    let tenantInfo = null;
    if (subdomain) {
      tenantInfo = await resolveTenant(subdomain, providerUrl);
      if (!tenantInfo || !tenantInfo.active) {
        const baseAppUrl = options.baseAppUrl || process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
        debugLog(`[SDK_PROXY] [${options.appId}] Tenant not found: ${subdomain}`);
        return NextResponse.redirect(new URL(`${baseAppUrl}/logout-success?error=tenant_not_found`));
      }
    }
    const getUnlocalizedPath = (path) => {
      const parts = path.split("/");
      return parts.length > 1 && parts[1].length === 2 ? "/" + parts.slice(2).join("/") : path;
    };
    const unlocalizedPath = getUnlocalizedPath(pathname);
    const isPublic = publicPaths.some((p) => {
      const normalizedPath = unlocalizedPath.replace(/\/$/, "") || "/";
      const normalizedParam = p.replace(/\/$/, "") || "/";
      if (normalizedParam === "/") return normalizedPath === "/";
      return normalizedPath === normalizedParam || normalizedPath.startsWith(normalizedParam + "/");
    });
    const sessionCookie = request.cookies.get(cookieName);
    debugLog(`[SDK_PROXY] [${options.appId}] Session cookie: ${sessionCookie?.value ? "PRESENT" : "MISSING"}`);
    let isAuthenticated = false, isAppNotAllowed = false, didVerifyThisRequest = false;
    let userEmail = "", userRole = "", userTenantId = "", userSessionId = "";
    let userTokenIat = 0;
    if (sessionCookie?.value) {
      const payload = await verifyToken(sessionCookie.value, jwtSecret);
      if (payload) {
        isAuthenticated = true;
        userEmail = payload.email;
        userRole = payload.role;
        userTenantId = payload.tenantId;
        userSessionId = payload.sessionId || "";
        userTokenIat = payload.iat || Math.floor(Date.now() / 1e3);
        if (payload.allowedApps && userRole !== "SUPER_ADMIN" && !payload.allowedApps.includes(options.appId)) {
          isAuthenticated = false;
          isAppNotAllowed = true;
        }
      }
    }
    if (isAuthenticated && tenantInfo && userTenantId !== tenantInfo.tenantId) isAuthenticated = false;
    if (isAuthenticated && tenantInfo && tenantInfo.allowedApps && userRole !== "SUPER_ADMIN" && !tenantInfo.allowedApps.includes(options.appId)) {
      isAuthenticated = false;
      isAppNotAllowed = true;
    }
    if (isAuthenticated && sessionCookie && userEmail && !request.cookies.get(verifiedCookieName)) {
      const isSessionActive = await verifySessionExpiry(userEmail, userSessionId, userTokenIat, request.url, providerUrl, clientSecret);
      if (isSessionActive) didVerifyThisRequest = true;
      else isAuthenticated = false;
    }
    if (isPublic && !isAuthenticated) return options.intlMiddleware ? options.intlMiddleware(request) : NextResponse.next();
    if (!isAuthenticated) {
      const currentUrl = new URL(request.url);
      const authorizeUrl = new URL(`${providerUrl}/api/auth/federated/authorize`, request.url);
      authorizeUrl.searchParams.set("client_id", options.clientId);
      authorizeUrl.searchParams.set("redirect_uri", `${currentUrl.protocol}//${currentUrl.host}/api/auth/federated/callback`);
      authorizeUrl.searchParams.set("state", pathname);
      if (isAppNotAllowed) authorizeUrl.searchParams.set("error", "app_not_allowed");
      if (tenantInfo) authorizeUrl.searchParams.set("tenant", tenantInfo.tenantId);
      const response2 = NextResponse.redirect(authorizeUrl);
      response2.cookies.set(cookieName, "", { path: "/", maxAge: 0, expires: /* @__PURE__ */ new Date(0) });
      response2.cookies.set(verifiedCookieName, "", { path: "/", maxAge: 0, expires: /* @__PURE__ */ new Date(0) });
      return response2;
    }
    const response = options.intlMiddleware ? await options.intlMiddleware(request) : NextResponse.next();
    if (didVerifyThisRequest) response.cookies.set(verifiedCookieName, "1", { path: "/", maxAge: 60, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
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

// src/utils/tenant-resolver.ts
import mongoose3 from "mongoose";

// src/utils/mongodb.ts
import mongoose2 from "mongoose";

// src/db/tenant-context.ts
import { AsyncLocalStorage } from "async_hooks";
var tenantStorage = new AsyncLocalStorage();

// src/db/tenant-connection.ts
import mongoose from "mongoose";
var g = global;
if (!g.tenantConnections) g.tenantConnections = {};
var connectionPool = g.tenantConnections;
function resolveTenantUri(baseUri, dbName) {
  const protocolMatch = baseUri.match(/^mongodb(?:\+srv)?:\/\//);
  if (!protocolMatch) throw new Error("Invalid MONGODB_URI protocol");
  const protocol = protocolMatch[0];
  const remaining = baseUri.substring(protocol.length);
  const qIndex = remaining.indexOf("?");
  const hostAndDb = qIndex === -1 ? remaining : remaining.substring(0, qIndex);
  const options = qIndex === -1 ? "" : remaining.substring(qIndex);
  const slashIndex = hostAndDb.lastIndexOf("/");
  if (slashIndex === -1) return `${protocol}${hostAndDb}/${dbName}${options}`;
  return `${protocol}${hostAndDb.substring(0, slashIndex)}/${dbName}${options}`;
}
function getTenantConnection(dbPrefix, isolationStrategy) {
  const cacheKey = isolationStrategy === "DATABASE_PER_TENANT" ? `DB_PER_TENANT:${dbPrefix}` : `COLL_PREFIX:${dbPrefix}`;
  if (connectionPool[cacheKey]) {
    connectionPool[cacheKey].lastUsed = Date.now();
    return connectionPool[cacheKey].connection;
  }
  const keys = Object.keys(connectionPool);
  if (keys.length >= 15) {
    let oldestKey = "", oldestTime = Infinity;
    for (const key of keys) {
      if (connectionPool[key].lastUsed < oldestTime) {
        oldestTime = connectionPool[key].lastUsed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const evicted = connectionPool[oldestKey];
      delete connectionPool[oldestKey];
      if (process.env.NODE_ENV !== "production") console.log(`[MultiTenant] Evicting LRU connection: ${oldestKey}`);
      evicted.connection.close().catch((err) => console.error(`[MultiTenant] Error closing evicted connection ${oldestKey}:`, err));
    }
  }
  const baseUri = process.env.MONGODB_URI || "";
  if (!baseUri) throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
  let targetUri = baseUri;
  if (isolationStrategy === "DATABASE_PER_TENANT") targetUri = resolveTenantUri(baseUri, `abd_tenant_${dbPrefix}`);
  if (process.env.NODE_ENV !== "production") console.log(`[MultiTenant] Creating connection for ${cacheKey} (Strategy: ${isolationStrategy})`);
  const opts2 = { bufferCommands: false, maxPoolSize: 3, serverSelectionTimeoutMS: 5e3, socketTimeoutMS: 45e3 };
  const conn = mongoose.createConnection(targetUri, opts2);
  conn.on("connected", () => {
    if (process.env.NODE_ENV !== "production") console.log(`[MultiTenant] Connection established for ${cacheKey}`);
  });
  conn.on("error", (err) => console.error(`[MultiTenant] Connection error for ${cacheKey}:`, err));
  connectionPool[cacheKey] = { connection: conn, lastUsed: Date.now() };
  return conn;
}
async function ensureConnectionReady(conn) {
  if (conn.readyState === 1) return conn;
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

// src/utils/mongodb.ts
var g2 = global;
var cached = g2.__mongoose || { conn: null, promise: null, authConn: null, authPromise: null, logsConn: null, logsPromise: null };
if (!g2.__mongoose) g2.__mongoose = cached;
var opts = { bufferCommands: false, maxPoolSize: 10, serverSelectionTimeoutMS: 5e3, socketTimeoutMS: 45e3 };
async function connectDB(serviceName) {
  const MONGODB_URI = process.env.MONGODB_URI || "";
  if (!MONGODB_URI) throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose2.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      if (process.env.NODE_ENV !== "production") console.log(`[DEV] ${serviceName || process.env.NEXT_PUBLIC_APP_ID || "satellite-app"} MongoDB connected to DATA Cluster`);
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
      await ensureConnectionReady(getTenantConnection(store.dbPrefix, store.isolationStrategy));
    } catch (e) {
      console.error(`[MultiTenant] Failed to connect to tenant database for ${store.dbPrefix}:`, e);
      throw e;
    }
  }
  return cached.conn;
}
async function connectCluster(key, URI, cacheKey, promiseKey, label) {
  if (cached[cacheKey]) return cached[cacheKey];
  if (!cached[promiseKey]) {
    const conn = mongoose2.createConnection(URI, opts);
    cached[promiseKey] = ensureConnectionReady(conn).then(() => {
      if (process.env.NODE_ENV !== "production") console.log(`[DEV] MongoDB connected to ${label} Cluster`);
      return conn;
    });
  }
  try {
    cached[cacheKey] = await cached[promiseKey];
  } catch (e) {
    cached[promiseKey] = null;
    throw e;
  }
  return cached[cacheKey];
}
async function connectAuthDB(serviceName) {
  return connectCluster("auth", process.env.MONGODB_AUTH_URI || process.env.MONGODB_URI || "", "authConn", "authPromise", "AUTH");
}
async function connectLogsDB(serviceName) {
  return connectCluster("logs", process.env.MONGODB_LOGS_URI || process.env.MONGODB_URI || "", "logsConn", "logsPromise", "LOGS");
}
function getConnectionSync(cacheKey, promiseKey, envVar, label) {
  if (cached[cacheKey]) return cached[cacheKey];
  const URI = process.env[envVar] || process.env.MONGODB_URI || "";
  if (!URI) throw new Error(`Missing ${envVar} or MONGODB_URI`);
  if (!cached[promiseKey]) {
    const conn = mongoose2.createConnection(URI, opts);
    cached[cacheKey] = conn;
    cached[promiseKey] = ensureConnectionReady(conn).then(() => {
      if (process.env.NODE_ENV !== "production") console.log(`[DEV] MongoDB connected to ${label} Cluster`);
      return conn;
    });
  }
  return cached[cacheKey];
}
function getAuthConnectionSync() {
  return getConnectionSync("authConn", "authPromise", "MONGODB_AUTH_URI", "AUTH");
}
function getLogsConnectionSync() {
  return getConnectionSync("logsConn", "logsPromise", "MONGODB_LOGS_URI", "LOGS");
}
var mongodb_default = connectDB;

// src/utils/tenant-resolver.ts
async function resolveTargetTenantContext(tenantId) {
  if (!tenantId || tenantId.trim() === "") {
    return void 0;
  }
  await connectDB();
  const conn = mongoose3.connection;
  if (conn.readyState !== 1) {
    console.warn("[TenantResolver] Default connection not ready, cannot resolve tenant");
    return void 0;
  }
  const authDbName = process.env.MONGODB_AUTH_DB || "ABDElevators-Auth";
  try {
    const authDb = conn.useDb(authDbName, { useCache: true });
    const tenantsCol = authDb.collection("tenants");
    const tenant = await tenantsCol.findOne(
      { tenantId, active: true },
      { projection: { tenantId: 1, dbPrefix: 1, isolationStrategy: 1 } }
    );
    if (!tenant) {
      console.warn(`[TenantResolver] Target tenant not found or inactive: ${tenantId}`);
      return void 0;
    }
    const resolved = {
      tenantId: tenant.tenantId,
      dbPrefix: tenant.dbPrefix || "default",
      isolationStrategy: tenant.isolationStrategy || "COLLECTION_PREFIX"
    };
    console.log(
      `[TenantResolver] Resolved context for tenant "${tenantId}":`,
      JSON.stringify(resolved)
    );
    return resolved;
  } catch (error) {
    console.error(`[TenantResolver] Failed to resolve tenant context for "${tenantId}":`, error);
    return void 0;
  }
}

// src/styles/BrandingStyles.tsx
import { headers } from "next/headers";
import { generateTenantCss } from "@ajabadia/styles";
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
  const jwtSecret = options.jwtSecret || process.env.AUTH_JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("[SDK] AUTH_JWT_SECRET is required. Pass via options.jwtSecret or AUTH_JWT_SECRET env var.");
  }
  const providerUrl = options.authProviderUrl || process.env.AUTH_PROVIDER_URL || "https://abd-auth.vercel.app";
  const clientId = options.clientId;
  const clientSecret = options.clientSecret || process.env.AUTH_CLIENT_SECRET || "";
  const cookieName = options.cookieName || "abd_session";
  const verifiedCookieName = options.verifiedCookieName || "abd_session_verified";
  return async function handler(request) {
    const { pathname, searchParams } = new URL(request.url);
    if (pathname.endsWith("/session")) {
      const session = await getIndustrialSession(jwtSecret);
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

// src/events.ts
var QuizEventAction = {
  SPACE_LINK_CREATE: "QUIZ_SPACE_LINK_CREATE",
  SPACE_LINK_UPDATE: "QUIZ_SPACE_LINK_UPDATE",
  COURSE_CREATE: "QUIZ_COURSE_CREATE",
  COURSE_UPDATE: "QUIZ_COURSE_UPDATE",
  COURSE_DELETE: "QUIZ_COURSE_DELETE",
  EXAM_CONFIG_CREATE: "QUIZ_EXAM_CONFIG_CREATE",
  EXAM_CONFIG_UPDATE: "QUIZ_EXAM_CONFIG_UPDATE",
  ASSIGNMENT_CREATE: "QUIZ_ASSIGNMENT_CREATE",
  ASSIGNMENT_PUBLISH: "QUIZ_ASSIGNMENT_PUBLISHED",
  ATTEMPT_STARTED: "QUIZ_ATTEMPT_STARTED",
  ANSWER_SUBMITTED: "QUIZ_ANSWER_SUBMITTED",
  ATTEMPT_COMPLETED: "QUIZ_ATTEMPT_COMPLETED",
  ATTEMPT_TIMEOUT: "QUIZ_ATTEMPT_TIMEOUT",
  ATTEMPT_MANUALLY_GRADED: "QUIZ_ATTEMPT_MANUALLY_GRADED",
  ATTEMPT_INVALIDATED: "QUIZ_ATTEMPT_INVALIDATED",
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

// src/utils/rateLimiter-mongodb.ts
import mongoose4, { Schema } from "mongoose";
var RateLimitSchema = new Schema({
  key: { type: String, required: true, index: true },
  points: { type: Number, default: 0 },
  expireAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  createdAt: { type: Date, default: Date.now }
});
var RateLimitModel = null;
function getModel() {
  if (RateLimitModel) return RateLimitModel;
  RateLimitModel = mongoose4.models.RateLimit || mongoose4.model("RateLimit", RateLimitSchema);
  return RateLimitModel;
}
var rateLimitMongodb = {
  /**
   * 🛡️ Check and increment rate limit for a specific key (atomic)
   *
   * Uses MongoDB's findOneAndUpdate with a conditional filter
   * `{ points: { $lt: limit } }` so the increment only happens when
   * the counter is still below the limit — all in one atomic operation.
   *
   * @returns true if allowed, false if throttled
   */
  async check(identifier, type, limit, windowSeconds) {
    await connectDB();
    const Model3 = getModel();
    const key = `${type}:${identifier}`;
    const now = /* @__PURE__ */ new Date();
    const expireAt = new Date(now.getTime() + windowSeconds * 1e3);
    const updated = await Model3.findOneAndUpdate(
      { key, expireAt: { $gt: now }, points: { $lt: limit } },
      { $inc: { points: 1 } },
      { returnDocument: "after" }
    ).exec();
    if (updated) return true;
    const existing = await Model3.findOne({ key, expireAt: { $gt: now } }).exec();
    if (existing) return false;
    await Model3.findOneAndUpdate(
      { key },
      {
        $set: { points: 1, expireAt },
        $setOnInsert: { key, createdAt: now }
      },
      { upsert: true }
    ).exec();
    return true;
  },
  /**
   * 🌐 Get Client IP from headers (works in serverless)
   * Uses platform-standard headers that Vercel, Cloudflare, etc. set.
   */
  getClientIp() {
    return "0.0.0.0";
  },
  /**
   * 🌐 Get Client IP using next/headers (async, needs request context)
   */
  async getClientIpAsync() {
    try {
      const { headers: headers2 } = await import("next/headers");
      const headerList = await headers2();
      const forwarded = headerList.get("x-forwarded-for");
      if (forwarded) return forwarded.split(",")[0].trim();
      const realIp = headerList.get("x-real-ip");
      if (realIp) return realIp.trim();
    } catch {
    }
    return "127.0.0.1";
  },
  /**
   * 🛡️ Convenience wrapper: get IP from a standard Request object
   */
  getClientIpFromRequest(request) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
    return "127.0.0.1";
  },
  /**
   * 🧹 Reset rate limit for a specific key
   */
  async reset(identifier, type) {
    await connectDB();
    const Model3 = getModel();
    const key = `${type}:${identifier}`;
    await Model3.deleteOne({ key }).exec();
  }
};

// src/db/tenant-model.ts
import mongoose5 from "mongoose";
async function withTenantContext(callback, explicitContext) {
  const activeStore = tenantStorage.getStore();
  if (activeStore) {
    await ensureConnectionReady(getTenantConnection(activeStore.dbPrefix, activeStore.isolationStrategy));
    return callback();
  }
  if (explicitContext) {
    await ensureConnectionReady(getTenantConnection(explicitContext.dbPrefix, explicitContext.isolationStrategy));
    return tenantStorage.run(explicitContext, callback);
  }
  try {
    const session = await getIndustrialSession();
    if (session?.authenticated && session.user?.tenantId) {
      const dbPrefix = session.user.dbPrefix || session.user.tenantId.toLowerCase().replace(/[^a-z0-9]/g, "");
      const context = { tenantId: session.user.tenantId, dbPrefix, isolationStrategy: session.user.isolationStrategy || "COLLECTION_PREFIX" };
      await ensureConnectionReady(getTenantConnection(context.dbPrefix, context.isolationStrategy));
      return tenantStorage.run(context, callback);
    }
  } catch (err) {
    console.warn("[TenantContext] Failed to get session:", err);
  }
  return callback();
}
function compileModelOnConnection(conn, modelName, schema, collectionName) {
  if (conn.models[modelName]) return conn.models[modelName];
  return conn.model(modelName, schema, collectionName);
}
function getModelForTenant(dbPrefix, isolationStrategy, modelName, schema, defaultCollectionName) {
  const conn = getTenantConnection(dbPrefix, isolationStrategy);
  const collectionName = isolationStrategy === "COLLECTION_PREFIX" ? `${dbPrefix}_${defaultCollectionName}` : defaultCollectionName;
  return compileModelOnConnection(conn, modelName, schema, collectionName);
}
function getTenantModel(modelName, schema) {
  const defaultModel = mongoose5.models[modelName] || mongoose5.model(modelName, schema);
  const defaultCollectionName = defaultModel.collection.name;
  return new Proxy(defaultModel, {
    get(target, prop, receiver) {
      const store = tenantStorage.getStore();
      if (!store) return Reflect.get(target, prop, receiver);
      const tenantModel = getModelForTenant(store.dbPrefix, store.isolationStrategy, modelName, schema, defaultCollectionName);
      const value = Reflect.get(tenantModel, prop);
      return typeof value === "function" ? value.bind(tenantModel) : value;
    },
    construct(target, args, newTarget) {
      const store = tenantStorage.getStore();
      if (!store) return Reflect.construct(target, args, newTarget);
      const tenantModel = getModelForTenant(store.dbPrefix, store.isolationStrategy, modelName, schema, defaultCollectionName);
      return Reflect.construct(tenantModel, args, newTarget);
    }
  });
}
function getGlobalModel(modelName, schema, clusterTarget) {
  let compiledModel = null;
  const getModelLazy = () => {
    if (compiledModel) return compiledModel;
    const conn = clusterTarget === "AUTH" ? getAuthConnectionSync() : getLogsConnectionSync();
    if (conn.models[modelName]) {
      compiledModel = conn.models[modelName];
    } else {
      compiledModel = conn.model(modelName, schema);
    }
    return compiledModel;
  };
  const dummyTarget = (() => {
  });
  return new Proxy(dummyTarget, {
    get(target, prop, receiver) {
      if (prop === "then" || prop === "constructor" || prop === "prototype") {
        return Reflect.get(target, prop, receiver);
      }
      const model = getModelLazy();
      const value = Reflect.get(model, prop);
      return typeof value === "function" ? value.bind(model) : value;
    },
    construct(target, args, newTarget) {
      const model = getModelLazy();
      return Reflect.construct(model, args, newTarget);
    },
    apply(target, thisArg, argumentsList) {
      const model = getModelLazy();
      return Reflect.apply(model, thisArg, argumentsList);
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

// src/utils/branding/color-utils.ts
function adjustColor(hex, percent) {
  if (!hex || !hex.startsWith("#")) return hex;
  try {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 255) + amt;
    const B = (num & 255) + amt;
    const clamp = (val) => val < 255 ? val < 0 ? 0 : val : 255;
    return "#" + (16777216 + clamp(R) * 65536 + clamp(G) * 256 + clamp(B)).toString(16).slice(1);
  } catch (e) {
    return hex;
  }
}
function getContrastColor(hexcolor) {
  if (!hexcolor || !hexcolor.startsWith("#")) return "#ffffff";
  try {
    const r = parseInt(hexcolor.substring(1, 3), 16);
    const g3 = parseInt(hexcolor.substring(3, 5), 16);
    const b = parseInt(hexcolor.substring(5, 7), 16);
    const yiq = (r * 299 + g3 * 587 + b * 114) / 1e3;
    return yiq >= 128 ? "#000000" : "#ffffff";
  } catch (e) {
    return "#ffffff";
  }
}
function hexToHslComponents(hex) {
  if (!hex || !hex.startsWith("#")) return "";
  try {
    const r = parseInt(hex.substring(1, 3), 16) / 255;
    const g3 = parseInt(hex.substring(3, 5), 16) / 255;
    const b = parseInt(hex.substring(5, 7), 16) / 255;
    const max = Math.max(r, g3, b);
    const min = Math.min(r, g3, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g3 - b) / d + (g3 < b ? 6 : 0);
          break;
        case g3:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g3) / d + 4;
          break;
      }
      h /= 6;
    }
    const hDeg = Math.round(h * 360);
    const sPct = Math.round(s * 100);
    const lPct = Math.round(l * 100);
    return `${hDeg} ${sPct}% ${lPct}%`;
  } catch (e) {
    return "";
  }
}

// src/utils/branding/css-generator.ts
function generateTenantCss2(theme) {
  if (!theme || !theme.primary) return "";
  const primary = theme.primary;
  const primaryFg = getContrastColor(primary);
  const secondary = theme.secondary || "#1e293b";
  const secondaryFg = getContrastColor(secondary);
  const accent = theme.accent || primary;
  const accentFg = getContrastColor(accent);
  const autoDark = theme.autoDarkMode !== false;
  const primaryDark = theme.primaryDark || (autoDark ? adjustColor(primary, 25) : "#38bdf8");
  const primaryDarkFg = getContrastColor(primaryDark);
  const accentDark = theme.accentDark || (autoDark ? adjustColor(accent, 15) : "#60a5fa");
  const accentDarkFg = getContrastColor(accentDark);
  const radius = theme.rounded === false ? "0rem" : theme.radius || "0.75rem";
  return `
    :root {
      --primary: ${primary};
      --primary-foreground: ${primaryFg};
      --secondary: ${secondary};
      --secondary-foreground: ${secondaryFg};
      --accent: ${accent};
      --accent-foreground: ${accentFg};
      --sidebar-primary: ${primary};
      --sidebar-primary-foreground: ${primaryFg};
      --ring: ${primary};
      --radius: ${radius};
      --tenant-primary: ${primary}; /* Retrocompatibilidad sat\xE9lite */
    }
    .dark {
      --primary: ${primaryDark};
      --primary-foreground: ${primaryDarkFg};
      --accent: ${accentDark};
      --accent-foreground: ${accentDarkFg};
      --sidebar-primary: ${primaryDark};
      --sidebar-primary-foreground: ${primaryDarkFg};
      --ring: ${primaryDark};
      --tenant-primary: ${primaryDark};
    }
    /* Estilos forzados de clases base */
    .text-primary { color: var(--primary) !important; }
    .bg-primary { background-color: var(--primary) !important; }
    .border-primary { border-color: var(--primary) !important; }
  `;
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

// src/utils/security.ts
import crypto2 from "crypto";
var ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
var SecurityService = class {
  static getSecret() {
    if (!ENCRYPTION_SECRET) {
      throw new Error("ENCRYPTION_SECRET no est\xE1 definida en las variables de entorno.");
    }
    return crypto2.scryptSync(ENCRYPTION_SECRET, "salt", 32);
  }
  /**
   * Cifra un texto utilizando AES-256-CBC de forma segura con un Vector de Inicialización (IV) aleatorio
   */
  static encrypt(text) {
    if (!text) return "";
    try {
      const iv = crypto2.randomBytes(16);
      const key = this.getSecret();
      const cipher = crypto2.createCipheriv("aes-256-cbc", key, iv);
      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");
      return `${iv.toString("hex")}:${encrypted}`;
    } catch (e) {
      console.error("\u274C Fallo al cifrar campo sensible:", e);
      return text;
    }
  }
  /**
   * Descifra un texto previamente cifrado. Si no está en formato cifrado (no contiene el separador ':'), lo devuelve tal cual.
   */
  static decrypt(encryptedText) {
    if (!encryptedText) return "";
    try {
      const parts = encryptedText.split(":");
      if (parts.length !== 2) return encryptedText;
      const iv = Buffer.from(parts[0], "hex");
      const encrypted = parts[1];
      const key = this.getSecret();
      const decipher = crypto2.createDecipheriv("aes-256-cbc", key, iv);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (e) {
      console.error("\u274C Fallo al descifrar campo sensible:", e);
      return encryptedText;
    }
  }
};

// src/utils/email.ts
var ResendEmailService = class {
  /**
   * Envia un correo electrónico utilizando la API REST de Resend.
   * Evita añadir dependencias pesadas de terceros al SDK.
   */
  static async sendEmail(options) {
    const apiKey = process.env.RESEND_API_KEY;
    const defaultFrom = process.env.RESEND_FROM_EMAIL;
    if (!apiKey) {
      throw new Error("Missing RESEND_API_KEY environment variable.");
    }
    const from = options.from || defaultFrom;
    if (!from) {
      throw new Error("Missing from sender address (either options.from or RESEND_FROM_EMAIL).");
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorMsg = data?.message || data?.error?.message || "Unknown Resend Error";
      throw new Error(`Resend API failed: ${errorMsg}`);
    }
    return { id: data.id };
  }
};
export {
  BrandingStyles,
  CircuitBreaker,
  CircuitState,
  FederatedSessionSchema,
  InsufficientPrivilegesError,
  QuizEntityType,
  QuizEventAction,
  RateLimiter,
  ResendEmailService,
  SecurityService,
  SessionVerifySchema,
  TenantInfoSchema,
  TokenResponseSchema,
  UnauthorizedAccessError,
  VerifiedTokenPayloadSchema,
  adjustColor,
  computeBlockHash,
  configureLogger,
  connectAuthDB,
  mongodb_default as connectDB,
  connectLogsDB,
  createAuthRouteHandler,
  createCircuitBreaker,
  createRateLimiter,
  mongodb_default as default,
  deleteCloudinaryAsset,
  ensureConnectionReady,
  ensureIndustrialAccess,
  fetchWithRetry,
  generateTenantCss2 as generateTenantCss,
  getContrastColor,
  getGlobalModel,
  getIndustrialSession,
  getTenantConnection,
  getTenantModel,
  getTenantSubdomain,
  hexToHslComponents,
  idpCircuitBreaker,
  idpRateLimiter,
  logger,
  rateLimitMongodb,
  redactPII,
  resolveTargetTenantContext,
  resolveTenantBranding,
  resolveTenantUri,
  tenantStorage,
  uploadBrandingAsset,
  verifyToken,
  withIndustrialAuth,
  withTenantContext
};
//# sourceMappingURL=index.mjs.map