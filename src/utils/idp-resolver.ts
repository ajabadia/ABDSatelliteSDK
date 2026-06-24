/**
 * @purpose Gestiona la recuperación de información del inquilino y la verificación de la caducidad de la sesión desde el proveedor de identidad central.
 * @purpose_en Manages fetching tenant information and verifying session expiry from the Central Identity Provider.
 * @refactorable false
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:2,imports:4,sig:jvpbwy
 * @lastUpdated 2026-06-23T23:25:37.359Z
 */

import { logger } from './logger';
import { fetchWithRetry } from './fetch-with-retry';
import type { TenantInfo, NextFetchRequestInit } from '../types';
import { TenantInfoSchema, SessionVerifySchema } from './schemas';

/**
 * 🏢 Fetch tenant info from the Central Identity Provider.
 */
export async function resolveTenant(subdomain: string, providerUrl: string): Promise<TenantInfo | null> {
  try {
    const url = `${providerUrl}/api/auth/tenant/info?subdomain=${subdomain}`;
    const result = await fetchWithRetry<TenantInfo>(url, {
      next: { revalidate: 60 } as NextFetchRequestInit['next'],
    }, 3, 100);

    if (result.ok && result.data) {
      return TenantInfoSchema.parse(result.data) as TenantInfo;
    }
  } catch (err) {
    logger.error('[SDK_TENANT_RESOLVE_ERROR] Failed to resolve tenant', err);
  }
  return null;
}

/**
 * 🛡️ Session Expiry Desync Check.
 */
export async function verifySessionExpiry(
  email: string,
  sessionId: string,
  tokenIat: number,
  requestUrl: string,
  providerUrl: string,
  clientSecret: string
): Promise<boolean> {
  try {
    const verifyUrl = new URL(`${providerUrl}/api/auth/session/verify`, requestUrl);
    verifyUrl.searchParams.set('email', email);
    if (sessionId) verifyUrl.searchParams.set('sessionId', sessionId);

    const result = await fetchWithRetry<{ active: boolean }>(verifyUrl.toString(), {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${clientSecret}`, 'Content-Type': 'application/json' },
      next: { revalidate: 0 } as NextFetchRequestInit['next'],
    }, 3, 100);

    if (result.ok && result.data) {
      const parsed = SessionVerifySchema.parse(result.data);
      return parsed.active;
    } else {
      const isWithin24h = (Date.now() / 1000) - tokenIat < 86400;
      logger.warn(`[SDK_SESSION_VERIFY_WARNING] Central IdP returned status ${result.status || 0}. Fallback (24h rule): ${isWithin24h}`);
      return isWithin24h;
    }
  } catch (err) {
    const isWithin24h = (Date.now() / 1000) - tokenIat < 86400;
    logger.error('[SDK_SESSION_VERIFY_ERROR] Failed to contact Central IdP. Fallback (24h rule):', err);
    return isWithin24h;
  }
}
