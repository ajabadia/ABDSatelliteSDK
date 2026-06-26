/**
 * @purpose Gestiona notificaciones emergentes basadas en el dominio actual.
 * @purpose_en Resolves tenant branding based on the current subdomain.
 * @refactorable false
 * @classification Helper Utility
 * @complexity Medium
 * @fingerprint exports:1,imports:3,sig:1el5hzt
 * @lastUpdated 2026-06-26T10:04:17.152Z
 */

import { getTenantSubdomain } from '../core/subdomain';
import { TenantInfoSchema } from '../core/schemas';
import type { TenantBranding, NextFetchRequestInit } from '../types';

/**
 * 🏢 Resuelve los datos de branding del tenant actual basado en el subdominio.
 * Función servidora (RSC-safe) para usar en layouts de las apps satélite.
 * Retorna null si no hay subdominio o si falla la resolución.
 *
 * ⚠️ Usa import dinámico de `next/headers` para no romper el bundle del SDK
 * en entornos que no tienen Next.js (tests, etc.).
 */
export async function resolveTenantBranding(): Promise<TenantBranding | null> {
  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const host = headersList.get('host');
    const subdomain = getTenantSubdomain(host);
    if (!subdomain) return null;

    const providerUrl = process.env.AUTH_PROVIDER_URL || '/auth';
    const verifyTenantUrl = `${providerUrl}/api/auth/tenant/info?subdomain=${subdomain}`;

    const res = await fetch(verifyTenantUrl, {
      next: { revalidate: 3600 },
    } as NextFetchRequestInit);

    if (!res.ok) return null;

    const rawData = await res.json();
    const data = TenantInfoSchema.parse(rawData);
    return (data.branding as TenantBranding) || null;
  } catch {
    return null;
  }
}
