import { describe, it, expect, vi } from 'vitest';
import { getTenantSubdomain } from './subdomain.js';

describe('getTenantSubdomain', () => {
  it('should return null for empty host', () => {
    expect(getTenantSubdomain(null)).toBeNull();
  });

  it('should return null for localhost', () => {
    expect(getTenantSubdomain('localhost')).toBeNull();
    expect(getTenantSubdomain('localhost:3000')).toBeNull();
  });

  it('should return null for IP addresses', () => {
    expect(getTenantSubdomain('127.0.0.1')).toBeNull();
    expect(getTenantSubdomain('127.0.0.1:8080')).toBeNull();
  });

  it('should extract subdomain from tenant.localhost', () => {
    expect(getTenantSubdomain('acme.localhost')).toBe('acme');
    expect(getTenantSubdomain('acme.localhost:3000')).toBe('acme');
  });

  it('should extract subdomain with custom root domain', () => {
    expect(getTenantSubdomain('client.mycompany.com', 'mycompany.com')).toBe('client');
    expect(getTenantSubdomain('client.mycompany.com:80', 'mycompany.com')).toBe('client');
  });

  it('should fallback to process.env.NEXT_PUBLIC_ROOT_DOMAIN', () => {
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'envcompany.com');
    expect(getTenantSubdomain('test.envcompany.com')).toBe('test');
    vi.unstubAllEnvs();
  });

  it('should return null for www', () => {
    expect(getTenantSubdomain('www.mycompany.com', 'mycompany.com')).toBeNull();
    expect(getTenantSubdomain('www.localhost')).toBeNull();
  });

  it('should extract subdomain from vercel deployments', () => {
    expect(getTenantSubdomain('tenant.app-name.vercel.app')).toBe('tenant');
    expect(getTenantSubdomain('app-name.vercel.app')).toBeNull();
  });
});
