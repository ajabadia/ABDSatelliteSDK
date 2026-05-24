import {
  FederatedSessionSchema,
  SessionVerifySchema,
  TenantInfoSchema,
  TokenResponseSchema,
  VerifiedTokenPayloadSchema
} from "./chunk-3LUM5OPQ.mjs";

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
async function resolveTenant(subdomain, providerUrl) {
  try {
    const url = `${providerUrl}/api/auth/tenant/info?subdomain=${subdomain}`;
    const res = await fetch(url, {
      next: { revalidate: 60 }
    });
    if (res.ok) {
      const data = await res.json();
      return TenantInfoSchema.parse(data);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[SDK_TENANT_RESOLVE_ERROR] Failed to resolve tenant", err);
    }
  }
  return null;
}
var debugLog = (msg) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(msg);
  }
};
async function verifySessionExpiry(email, sessionId, tokenIat, requestUrl, providerUrl, clientSecret) {
  try {
    const verifyUrl = new URL(`${providerUrl}/api/auth/session/verify`, requestUrl);
    verifyUrl.searchParams.set("email", email);
    if (sessionId) {
      verifyUrl.searchParams.set("sessionId", sessionId);
    }
    const response = await fetch(verifyUrl.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${clientSecret}`,
        "Content-Type": "application/json"
      },
      next: { revalidate: 0 }
    });
    if (response.ok) {
      const data = await response.json();
      const parsed = SessionVerifySchema.parse(data);
      return parsed.active;
    } else {
      const isWithin24h = Date.now() / 1e3 - tokenIat < 86400;
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[SDK_SESSION_VERIFY_WARNING] Central IdP returned status ${response.status}. Fallback (24h rule): ${isWithin24h}`);
      }
      return isWithin24h;
    }
  } catch (err) {
    const isWithin24h = Date.now() / 1e3 - tokenIat < 86400;
    if (process.env.NODE_ENV !== "production") {
      console.error("[SDK_SESSION_VERIFY_ERROR] Failed to contact Central IdP. Fallback (24h rule):", isWithin24h);
    }
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
    return {
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
        permissions: payload.permissions || [],
        allowedApps: payload.allowedApps || []
      }
    };
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
        console.error("[SDK_CALLBACK_EXCHANGE_ERROR]", err);
        return NextResponse2.json({ error: "Internal server error during token exchange" }, { status: 500 });
      }
    }
    return NextResponse2.json({ error: "Route not found" }, { status: 404 });
  };
}

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
export {
  BrandingStyles,
  FederatedSessionSchema,
  InsufficientPrivilegesError,
  SessionVerifySchema,
  TenantInfoSchema,
  TokenResponseSchema,
  UnauthorizedAccessError,
  VerifiedTokenPayloadSchema,
  configureLogger,
  createAuthRouteHandler,
  ensureIndustrialAccess,
  getIndustrialSession,
  getTenantSubdomain,
  logger,
  redactPII,
  verifyToken,
  withIndustrialAuth
};
//# sourceMappingURL=index.mjs.map