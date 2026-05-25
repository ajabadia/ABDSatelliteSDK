import type { NextRequest, NextResponse } from 'next/server';

export interface NextFetchRequestConfig {
  revalidate?: number | false;
  tags?: string[];
}

export interface NextFetchRequestInit extends RequestInit {
  next?: NextFetchRequestConfig;
}

export interface TenantBrandingTheme {
  primary: string;
  secondary?: string;
  background?: string;
  rounded?: boolean;
  radius?: string;
}

export interface TenantBranding {
  logoUrl?: string | null;
  logo?: {
    url?: string | null;
    publicId?: string;
  } | null;
  favicon?: {
    url?: string | null;
    publicId?: string;
  } | null;
  theme?: TenantBrandingTheme | null;
}

export interface TenantInfo {
  active: boolean;
  tenantId: string;
  name: string;
  dbPrefix: string;
  isolationStrategy: string;
  allowedApps: string[];
  branding: TenantBranding | null;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  surname: string;
  role: string;
  tenantId: string;
  dbPrefix: string;
  isolationStrategy: string;
  permissions?: string[];
  allowedApps?: string[];
}

export interface FederatedSession {
  authenticated: boolean;
  user?: UserProfile;
}

export interface IndustrialAuthOptions {
  appId: string;
  clientId: string;
  clientSecret?: string;
  jwtSecret?: string;
  authProviderUrl?: string;
  baseAppUrl?: string;
  publicPaths?: string[];
  cookieName?: string;
  verifiedCookieName?: string;
  intlMiddleware?: (request: NextRequest) => Promise<NextResponse> | NextResponse;
}

/**
 * 🔁 Result type for fetchWithRetry utility.
 */
export interface FetchRetryResult<T> {
  /** Whether the fetch succeeded (2xx status) */
  ok: boolean;
  /** Parsed JSON response data (only if ok is true) */
  data?: T;
  /** HTTP status code (if response was received) */
  status?: number;
  /** Error message string (if all retries failed) */
  error?: string;
}
