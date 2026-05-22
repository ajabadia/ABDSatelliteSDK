/**
 * 🏢 Helper to extract tenant subdomain from host header.
 * Excludes main Control Plane and localhost domains.
 */
export function getTenantSubdomain(host: string | null, rootDomain?: string): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0].toLowerCase();
  
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
    const parts = prefix.split('.');
    const subdomain = parts[0];
    if (subdomain === 'www') return null;
    return subdomain;
  }
  
  // Specific handler for Vercel deployment subdomains fallback
  if (hostname.endsWith('.vercel.app')) {
    if (parts.length > 3) {
      return parts[0];
    }
    return null;
  }
  
  // Standard production custom domains (e.g., tenant.abdelevators.com -> parts.length === 3)
  if (parts.length > 2) {
    const subdomain = parts[0];
    if (subdomain === 'www') return null;
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
