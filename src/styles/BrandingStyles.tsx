import { headers } from 'next/headers';
import { generateTenantCss } from '@abd/styles/dist/engine/css-generator.js';
import { getTenantSubdomain } from '../utils/subdomain';
import type { TenantInfo } from '../types';

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
    } as RequestInit & { next?: { revalidate: number } });

    if (!res.ok) {
      return null;
    }

    const data = await res.json() as TenantInfo;
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
    console.error('[SDK_BRANDING_STYLES_ERROR] Failed to inject dynamic styling', err);
  }

  return null;
}
