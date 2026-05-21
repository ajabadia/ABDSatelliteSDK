// src/utils/crypto.ts
import { jwtVerify } from "jose";
function getSecretKey(customSecret) {
  const secret = customSecret || process.env.AUTH_JWT_SECRET || "abd-auth-industrial-fallback-secret-2026";
  return new TextEncoder().encode(secret);
}
async function verifyToken(token, customSecret) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(customSecret));
    return payload;
  } catch (err) {
    return null;
  }
}

// src/utils/subdomain.ts
function getTenantSubdomain(host) {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  if (hostname === "abd-tenant-gobernance.vercel.app" || hostname === "localhost" || hostname === "127.0.0.1") {
    return null;
  }
  const parts = hostname.split(".");
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
    return parts[0];
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
      return await res.json();
    }
  } catch (err) {
    console.error("[SDK_TENANT_RESOLVE_ERROR]", err);
  }
  return null;
}
async function verifySessionExpiry(email, sessionId, requestUrl, providerUrl, clientSecret) {
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
      return !!data.active;
    } else {
      console.warn(`[SDK_SESSION_VERIFY_WARNING] Central IdP returned status ${response.status}. Falling back to local session.`);
      return true;
    }
  } catch (err) {
    console.error("[SDK_SESSION_VERIFY_ERROR] Failed to contact Central IdP. Falling back to local session.", err);
    return true;
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
    let isAuthenticated = false;
    let isAppNotAllowed = false;
    let didVerifyThisRequest = false;
    let userEmail = "";
    let userRole = "";
    let userTenantId = "";
    let userSessionId = "";
    if (sessionCookie?.value) {
      const payload = await verifyToken(sessionCookie.value, jwtSecret);
      if (payload) {
        isAuthenticated = true;
        userEmail = payload.email;
        userRole = payload.role;
        userTenantId = payload.tenantId;
        userSessionId = payload.sessionId || "";
        if (payload.allowedApps && userRole !== "SUPER_ADMIN") {
          if (!payload.allowedApps.includes(options.appId)) {
            console.warn(`[SDK_AUTH_BLOCKED] User allowedApps does not include '${options.appId}'`);
            isAuthenticated = false;
            isAppNotAllowed = true;
          }
        }
      }
    }
    if (isAuthenticated && tenantInfo && userTenantId !== tenantInfo.tenantId) {
      console.warn(`[SDK_CROSS_TENANT_SECURITY_BLOCKED] User tenant '${userTenantId}' does not match host tenant '${tenantInfo.tenantId}'`);
      isAuthenticated = false;
    }
    if (isAuthenticated && tenantInfo && tenantInfo.allowedApps && userRole !== "SUPER_ADMIN") {
      if (!tenantInfo.allowedApps.includes(options.appId)) {
        console.warn(`[SDK_TENANT_BLOCKED] Tenant '${tenantInfo.tenantId}' allowedApps does not include '${options.appId}'`);
        isAuthenticated = false;
        isAppNotAllowed = true;
      }
    }
    if (isAuthenticated && sessionCookie && userEmail) {
      const verifiedCookie = request.cookies.get(verifiedCookieName);
      if (!verifiedCookie) {
        const isSessionActive = await verifySessionExpiry(userEmail, userSessionId, request.url, providerUrl, clientSecret);
        if (isSessionActive) {
          didVerifyThisRequest = true;
        } else {
          console.warn(`[SDK_SESSION_EXPIRED] User session is inactive at central IdP`);
          isAuthenticated = false;
        }
      }
    }
    if (isPublic && !isAuthenticated) {
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
    return { authenticated: false };
  }
}
async function ensureIndustrialAccess(requiredRole, customSecret) {
  const session = await getIndustrialSession(customSecret);
  if (!session.authenticated || !session.user) {
    throw new Error("UNAUTHORIZED_ECOSYSTEM_ACCESS");
  }
  if (requiredRole && session.user.role !== requiredRole && session.user.role !== "SUPER_ADMIN") {
    throw new Error("INSUFFICIENT_INDUSTRIAL_PRIVILEGES");
  }
  return session.user;
}

// src/styles/BrandingStyles.tsx
import { headers } from "next/headers";
import { generateTenantCss } from "@abd/styles/dist/engine/css-generator.js";
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
    const data = await res.json();
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
    console.error("[SDK_BRANDING_STYLES_ERROR] Failed to inject dynamic styling", err);
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
      if (!code) {
        return NextResponse2.json({ error: "No authorization code provided" }, { status: 400 });
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
        const data = await res.json();
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
export {
  BrandingStyles,
  createAuthRouteHandler,
  ensureIndustrialAccess,
  getIndustrialSession,
  getTenantSubdomain,
  verifyToken,
  withIndustrialAuth
};
//# sourceMappingURL=index.mjs.map