/**
 * @purpose Proporciona plantillas y tipos para interfaces de datos utilizados en el SDK ABDSatelliteSDK.
 * @purpose_en Defines TypeScript interfaces and types for various data structures used in the ABDSatelliteSDK application.
 * @refactorable false
 * @classification Type Definition
 * @complexity Low
 * @fingerprint exports:9,imports:1,sig:1qlaljs
 * @lastUpdated 2026-06-26T10:04:12.536Z
 */

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
  logo?: { url?: string | null; publicId?: string } | null;
  favicon?: { url?: string | null; publicId?: string } | null;
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
  verifiedCookieMaxAge?: number;
  intlMiddleware?: (request: NextRequest) => Promise<NextResponse> | NextResponse;
}

export interface FetchRetryResult<T> {
  ok: boolean;
  data?: T;
  status?: number;
  error?: string;
}
