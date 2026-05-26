import {
  FederatedSessionSchema,
  SessionVerifySchema,
  TenantInfoSchema,
  TokenResponseSchema,
  VerifiedTokenPayloadSchema
} from "./chunk-SZEJBU4U.mjs";

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

// src/utils/logger.ts
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
function configureLogger(config) {
  globalConfig = { ...globalConfig, ...config };
}
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
  if (val === null || val === void 0) {
    return val;
  }
  if (typeof val === "string") {
    if (keyName && SENSITIVE_KEYS.some((k) => keyName.toLowerCase().includes(k))) {
      return "[REDACTED]";
    }
    let cleaned = val;
    cleaned = cleaned.replace(EMAIL_REGEX, "[REDACTED_EMAIL]");
    cleaned = cleaned.replace(CREDIT_CARD_REGEX, "[REDACTED_CARD]");
    return cleaned;
  }
  if (Array.isArray(val)) {
    return val.map((item) => redactPII(item, keyName));
  }
  if (typeof val === "object") {
    if (val instanceof Date || val instanceof RegExp) {
      return val;
    }
    const copy = {};
    const keys = Object.keys(val);
    for (const k of keys) {
      copy[k] = redactPII(val[k], k);
    }
    return copy;
  }
  if (keyName && SENSITIVE_KEYS.some((k) => keyName.toLowerCase().includes(k))) {
    return "[REDACTED]";
  }
  return val;
}
function logToConsole(level, message, meta) {
  const minConfigLevel = globalConfig.minLevel || "INFO";
  if (LEVEL_VALUES[level] < LEVEL_VALUES[minConfigLevel]) {
    return;
  }
  const logObject = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    level,
    appId: globalConfig.appId,
    message: redactPII(message),
    meta: meta ? redactPII(meta) : void 0
  };
  const jsonString = JSON.stringify(logObject);
  if (level === "ERROR") {
    console.error(jsonString);
  } else if (level === "WARN") {
    console.warn(jsonString);
  } else {
    console.log(jsonString);
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
    let msg = "";
    let finalMeta = meta || {};
    if (errorOrMessage instanceof Error) {
      msg = errorOrMessage.message;
      finalMeta = {
        ...finalMeta,
        stack: errorOrMessage.stack,
        name: errorOrMessage.name
      };
    } else {
      msg = String(errorOrMessage);
    }
    logToConsole("ERROR", msg, finalMeta);
  },
  /**
   * 📡 Transmits a forensic audit log recursively redacted of PII (except for root userEmail)
   * to the ABDLogs central microservice in a non-blocking (fire-and-forget) manner.
   */
  audit(payload) {
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
      // El correo raíz no se enmascara para preservar rastreo de identidad
    });
    if (!token && process.env.NODE_ENV === "production") {
      console.error("[LOGGER_AUDIT_WARNING] Fail-safe active: LOGS_SECRET_TOKEN is missing in production environment variables.");
      return;
    }
    fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token || "dev-bypass-token"}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...redactedPayload,
        createdAt: /* @__PURE__ */ new Date()
      })
    }).catch((err) => {
      console.error(`[LOGGER_AUDIT_ERROR][${appId}] Fail-safe fallback active. Failed to transmit forensic log to central service:`, err instanceof Error ? err.message : err);
    });
  }
};

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
export {
  BrandingStyles,
  CircuitBreaker,
  CircuitState,
  FederatedSessionSchema,
  InsufficientPrivilegesError,
  RateLimiter,
  SessionVerifySchema,
  TenantInfoSchema,
  TokenResponseSchema,
  UnauthorizedAccessError,
  VerifiedTokenPayloadSchema,
  configureLogger,
  createAuthRouteHandler,
  createCircuitBreaker,
  createRateLimiter,
  ensureIndustrialAccess,
  fetchWithRetry,
  getIndustrialSession,
  getTenantSubdomain,
  idpCircuitBreaker,
  idpRateLimiter,
  logger,
  redactPII,
  verifyToken,
  withIndustrialAuth
};
//# sourceMappingURL=index.mjs.map