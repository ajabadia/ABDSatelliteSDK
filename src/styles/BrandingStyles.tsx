/**
 * @purpose Renderiza un componente React Server para inyectar marcas de tenant en el cabezal del documento utilizando variables de Tailwind CSS.
 * @purpose_en Renders a React Server Component for injecting tenant branding into the document head using Tailwind CSS variables.
 * @refactorable false
 * @classification UI Component
 * @complexity Medium
 * @fingerprint exports:1,imports:5,sig:zshxjb
 * @lastUpdated 2026-06-23T23:24:48.368Z
 */

import { headers } from 'next/headers';
import { generateTenantCss } from '@ajabadia/styles';
import { getTenantSubdomain } from '../core/subdomain';
import type { TenantInfo, NextFetchRequestInit } from '../types';
import { TenantInfoSchema } from '../core/schemas.js';

interface BrandingStylesProps {
  authProviderUrl?: string;
  revalidateSeconds?: number;
}

/**
 * 🎨 React Server Component for Zero-FOUC Tenant Branding Injection.
 * Places a <style> block in the document head with Tailwind CSS v4 compliant variables.
 */
export async function BrandingStyles({
  authProviderUrl,
  revalidateSeconds = 3600
}: BrandingStylesProps) {
  try {
    const headersList = await headers();
    const host = headersList.get('host');
    const subdomain = getTenantSubdomain(host);

    if (!subdomain) return null;

    const providerUrl = authProviderUrl || process.env.AUTH_PROVIDER_URL || 'https://abd-auth.vercel.app';
    const verifyTenantUrl = `${providerUrl}/api/auth/tenant/info?subdomain=${subdomain}`;

    const res = await fetch(verifyTenantUrl, {
      next: { revalidate: revalidateSeconds }
    } as NextFetchRequestInit);

    if (!res.ok) {
      return null;
    }

    const rawData = await res.json();
    const data = TenantInfoSchema.parse(rawData) as TenantInfo;
    const branding = data.branding;

    const customCss = branding?.theme ? generateTenantCss(branding.theme) : null;
    const faviconUrl = branding?.favicon?.url || null;

    if (!customCss && !faviconUrl) {
      return null;
    }

    return (
      <>
        {customCss && (
          <style
            id="tenant-branding-gateway"
            dangerouslySetInnerHTML={{ __html: customCss }}
          />
        )}
        {faviconUrl && (
          <link rel="icon" href={faviconUrl} />
        )}
      </>
    );
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[SDK_BRANDING_STYLES_ERROR] Failed to inject dynamic styling', err);
    }
  }

  return null;
}
