/**
 * 🏢 Helper to extract tenant subdomain from host header.
 * Excludes main Control Plane and localhost domains.
 */
export function getTenantSubdomain(host: string | null): string | null {
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
  
  // Specific handler for Vercel deployment subdomains (e.g., tenant.abd-tenant-gobernance.vercel.app -> parts.length === 4)
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
    return parts[0];
  }
  
  return null;
}
