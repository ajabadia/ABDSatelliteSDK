import { NextRequest, NextResponse } from 'next/server';

interface TenantBrandingTheme {
    primary: string;
    secondary?: string;
    background?: string;
    rounded?: boolean;
    radius?: string;
}
interface TenantBranding {
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
interface TenantInfo {
    active: boolean;
    tenantId: string;
    name: string;
    dbPrefix: string;
    isolationStrategy: string;
    allowedApps: string[];
    branding: TenantBranding | null;
}
interface UserProfile {
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
interface FederatedSession {
    authenticated: boolean;
    user?: UserProfile;
}
interface IndustrialAuthOptions {
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

export type { FederatedSession as F, IndustrialAuthOptions as I, TenantBranding as T, UserProfile as U, TenantBrandingTheme as a, TenantInfo as b };
