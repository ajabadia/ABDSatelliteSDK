"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }





var _chunkWCPFHMSBjs = require('./chunk-WCPFHMSB.js');

// src/utils/crypto.ts
var _jose = require('jose');
function getSecretKey(customSecret) {
  const secret = customSecret || process.env.AUTH_JWT_SECRET;
  if (!secret) throw new Error("[SDK] AUTH_JWT_SECRET is required");
  return new TextEncoder().encode(secret);
}
async function verifyToken(token, customSecret) {
  try {
    const { payload } = await _jose.jwtVerify.call(void 0, token, getSecretKey(customSecret));
    return _chunkWCPFHMSBjs.VerifiedTokenPayloadSchema.parse(payload);
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
var _server = require('next/server');
async function resolveTenant(subdomain, providerUrl) {
  try {
    const url = `${providerUrl}/api/auth/tenant/info?subdomain=${subdomain}`;
    const res = await fetch(url, {
      next: { revalidate: 60 }
    });
    if (res.ok) {
      const data = await res.json();
      return _chunkWCPFHMSBjs.TenantInfoSchema.parse(data);
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
      const parsed = _chunkWCPFHMSBjs.SessionVerifySchema.parse(data);
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
      return options.intlMiddleware ? options.intlMiddleware(request) : _server.NextResponse.next();
    }
    const host = request.headers.get("host");
    const subdomain = getTenantSubdomain(host);
    let tenantInfo = null;
    if (subdomain) {
      tenantInfo = await resolveTenant(subdomain, providerUrl);
      if (!tenantInfo || !tenantInfo.active) {
        const baseAppUrl = options.baseAppUrl || process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
        debugLog(`[SDK_PROXY] [${options.appId}] Tenant inactive or not found: ${subdomain}`);
        return _server.NextResponse.redirect(new URL(`${baseAppUrl}/logout-success?error=tenant_not_found`));
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
    debugLog(`[SDK_PROXY] [${options.appId}] Session cookie '${cookieName}': ${_optionalChain([sessionCookie, 'optionalAccess', _ => _.value]) ? "PRESENT" : "MISSING"}`);
    let isAuthenticated = false;
    let isAppNotAllowed = false;
    let didVerifyThisRequest = false;
    let userEmail = "";
    let userRole = "";
    let userTenantId = "";
    let userSessionId = "";
    let userTokenIat = 0;
    if (_optionalChain([sessionCookie, 'optionalAccess', _2 => _2.value])) {
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
      debugLog(`[SDK_PROXY] [${options.appId}] Verified cookie '${verifiedCookieName}': ${_optionalChain([verifiedCookie, 'optionalAccess', _3 => _3.value]) ? "PRESENT" : "MISSING"}`);
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
      return options.intlMiddleware ? options.intlMiddleware(request) : _server.NextResponse.next();
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
      const response2 = _server.NextResponse.redirect(authorizeUrl);
      response2.cookies.set(cookieName, "", { path: "/", maxAge: 0, expires: /* @__PURE__ */ new Date(0) });
      response2.cookies.set(verifiedCookieName, "", { path: "/", maxAge: 0, expires: /* @__PURE__ */ new Date(0) });
      return response2;
    }
    const response = options.intlMiddleware ? await options.intlMiddleware(request) : _server.NextResponse.next();
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
var _headers = require('next/headers');
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
    const cookieStore = await _headers.cookies.call(void 0, );
    const sessionCookie = cookieStore.get("abd_session");
    if (!_optionalChain([sessionCookie, 'optionalAccess', _4 => _4.value])) {
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

var _styles = require('@abd/styles');
var _jsxruntime = require('react/jsx-runtime');
async function BrandingStyles({
  authProviderUrl,
  revalidateSeconds = 3600
}) {
  try {
    const headersList = await _headers.headers.call(void 0, );
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
    const data = _chunkWCPFHMSBjs.TenantInfoSchema.parse(rawData);
    const branding = data.branding;
    const customCss = _optionalChain([branding, 'optionalAccess', _5 => _5.theme]) ? _styles.generateTenantCss.call(void 0, branding.theme) : null;
    const faviconUrl = _optionalChain([branding, 'optionalAccess', _6 => _6.favicon, 'optionalAccess', _7 => _7.url]) || null;
    if (!customCss && !faviconUrl) {
      return null;
    }
    return /* @__PURE__ */ _jsxruntime.jsxs.call(void 0, _jsxruntime.Fragment, { children: [
      customCss && /* @__PURE__ */ _jsxruntime.jsx.call(void 0, 
        "style",
        {
          id: "tenant-branding-gateway",
          dangerouslySetInnerHTML: { __html: customCss }
        }
      ),
      faviconUrl && /* @__PURE__ */ _jsxruntime.jsx.call(void 0, "link", { rel: "icon", href: faviconUrl })
    ] });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[SDK_BRANDING_STYLES_ERROR] Failed to inject dynamic styling", err);
    }
  }
  return null;
}

// src/routeHandler.ts

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
      return _server.NextResponse.json(session);
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
        const response2 = new (0, _server.NextResponse)(null, { status: 200 });
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
      const response = _server.NextResponse.redirect(
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
        return _server.NextResponse.json({ error: "Invalid or missing authorization code" }, { status: 400 });
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
          return _server.NextResponse.json({ error: "Token exchange failed", detail: errorData }, { status: 401 });
        }
        const rawData = await res.json();
        const data = _chunkWCPFHMSBjs.TokenResponseSchema.parse(rawData);
        const redirectResponse = _server.NextResponse.redirect(new URL(state, request.url));
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
        return _server.NextResponse.json({ error: "Internal server error during token exchange" }, { status: 500 });
      }
    }
    return _server.NextResponse.json({ error: "Route not found" }, { status: 404 });
  };
}















exports.BrandingStyles = BrandingStyles; exports.FederatedSessionSchema = _chunkWCPFHMSBjs.FederatedSessionSchema; exports.InsufficientPrivilegesError = InsufficientPrivilegesError; exports.SessionVerifySchema = _chunkWCPFHMSBjs.SessionVerifySchema; exports.TenantInfoSchema = _chunkWCPFHMSBjs.TenantInfoSchema; exports.TokenResponseSchema = _chunkWCPFHMSBjs.TokenResponseSchema; exports.UnauthorizedAccessError = UnauthorizedAccessError; exports.VerifiedTokenPayloadSchema = _chunkWCPFHMSBjs.VerifiedTokenPayloadSchema; exports.createAuthRouteHandler = createAuthRouteHandler; exports.ensureIndustrialAccess = ensureIndustrialAccess; exports.getIndustrialSession = getIndustrialSession; exports.getTenantSubdomain = getTenantSubdomain; exports.verifyToken = verifyToken; exports.withIndustrialAuth = withIndustrialAuth;
//# sourceMappingURL=index.js.map