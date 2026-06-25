/**
 * @purpose Gestiona el dominio subdominio del teniente desde la cabecera del host, excluyendo ciertos dominios y aplicaciones del sistema.
 * @purpose_en Extracts the tenant subdomain from a host header, excluding specific domains and system applications.
 * @refactorable false
 * @classification Helper Utility
 * @complexity Medium
 * @fingerprint exports:1,imports:0,sig:1ow4npz
 * @lastUpdated 2026-06-23T23:25:54.525Z
 */

/**
 * 🏢 Helper to extract tenant subdomain from host header.
 * Excludes main Control Plane and localhost domains.
 */
export function getTenantSubdomain(host: string | null, rootDomain?: string): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0].toLowerCase();
  
  const systemApps = ['auth', 'logs', 'quiz', 'analytics', 'tenantgobernance', 'suite', 'landing', 'www', 'files'];

  // Prevent extracting subdomain if accessing base Control Plane domains
  if (
    hostname === 'abd-tenant-gobernance.vercel.app' || 
    hostname === 'localhost' || 
    hostname === '127.0.0.1'
  ) {
    return null;
  }

  const parts = hostname.split('.');
  // Dynamic root domain matching to avoid hardcoding Vercel
  const root = rootDomain || process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (root && hostname.endsWith(`.${root}`)) {
    const prefix = hostname.slice(0, -(root.length + 1));
    const prefixParts = prefix.split('.');
    const subdomain = prefixParts[0];
    if (systemApps.includes(subdomain)) return null;
    return subdomain;
  }
  
  // Specific handler for Vercel deployment subdomains fallback
  if (hostname.endsWith('.vercel.app')) {
    if (parts.length > 3) {
      const subdomain = parts[0];
      if (systemApps.includes(subdomain)) return null;
      return subdomain;
    }
    return null;
  }
  
  // Standard production custom domains (e.g., tenant.abdelevators.com -> parts.length === 3)
  if (parts.length > 2) {
    const subdomain = parts[0];
    if (systemApps.includes(subdomain)) return null;
    return subdomain;
  }
  
  // Standard local subdomains (e.g., tenant.localhost -> parts.length === 2)
  if (parts.length === 2 && parts[1] === 'localhost') {
    const subdomain = parts[0];
    if (subdomain === 'www') return null;
    return subdomain;
  }
  
  return null;
}
