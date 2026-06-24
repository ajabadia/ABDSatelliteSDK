# 🛰️ @ajabadia/satellite-sdk

[![ERA 11 Certified](https://img.shields.io/badge/ERA%2011-CERTIFIED-brightgreen?style=for-the-badge&logo=shield)](../.github/workflows/audit.yml)

Centralized npm package for high-speed integration of satellite applications within the **ABD Industrial Ecosystem**. 

This SDK provides all the foundational tooling required to connect a satellite app to the central infrastructure, including:

- 🔐 **Authentication & Security**: SSO federated callbacks, JWT decryption (via `jose`), and route protection with allowed-apps licensing checks.
- 🏢 **Tenant Management**: Domain-tenant resolution, loop mitigation, and strict cross-tenant security guardrails.
- 🎨 **Branding Injection (SSR)**: Zero-FOUC dynamic theme style injections compatible with Tailwind CSS v4.
- 📝 **Structured Logging**: Centralized, SOC2/GDPR compliant logging with automatic PII redaction for the `ABDLogs` microservice.

---

## 🚀 Quick Start (Under 5 Minutes)

### 1. Install Dependecies

Make sure `@ajabadia/styles` is linked in your `package.json`, then install the SDK:

```bash
pnpm add @ajabadia/satellite-sdk
```

### 2. Configure Environment Variables (`.env`)

```env
NEXT_PUBLIC_APP_ID="your-satellite-slug"
AUTH_CLIENT_ID="your-client-id"
AUTH_CLIENT_SECRET="your-super-secret-client-key"
AUTH_JWT_SECRET="the-shared-suite-cryptographic-jwt-secret"
AUTH_PROVIDER_URL="https://abd-auth.vercel.app"
```

### 3. Create the API Route Handler (`src/app/api/auth/[...auth]/route.ts`)

Create a catch-all route to handle login callback, logout, and session status:

```typescript
import { createAuthRouteHandler } from '@ajabadia/satellite-sdk';

const handler = createAuthRouteHandler({
  appId: process.env.NEXT_PUBLIC_APP_ID!,
  clientId: process.env.AUTH_CLIENT_ID!,
  clientSecret: process.env.AUTH_CLIENT_SECRET!,
  jwtSecret: process.env.AUTH_JWT_SECRET!,
});

export { handler as GET, handler as POST };
```

### 4. Create the Proxy Guard (`src/proxy.ts`)

Protect your routes, handle allowedApps verification, and prevent loop redirections:

```typescript
import { withIndustrialAuth } from '@ajabadia/satellite-sdk';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export const proxy = withIndustrialAuth({
  appId: process.env.NEXT_PUBLIC_APP_ID!,
  clientId: process.env.AUTH_CLIENT_ID!,
  clientSecret: process.env.AUTH_CLIENT_SECRET!,
  jwtSecret: process.env.AUTH_JWT_SECRET!,
  publicPaths: ['/', '/logout-success'],
  intlMiddleware,
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.svg$).*)'],
};
```

### 5. Setup Root Layout (`src/app/[locale]/layout.tsx`)

Inject tenant branding styles dynamically and wrap client components with the session provider:

```tsx
import { BrandingStyles, SessionProvider, getIndustrialSession } from '@ajabadia/satellite-sdk';

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const session = await getIndustrialSession();

  return (
    <html lang={params.locale}>
      <head>
        {/* Dynamic theme style injection (Zero-FOUC) */}
        <BrandingStyles />
      </head>
      <body>
        <SessionProvider initialSession={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

### 6. Read Session (Server & Client Components)

*   **Server Components & APIs**:
    ```typescript
    import { getIndustrialSession, ensureIndustrialAccess } from '@ajabadia/satellite-sdk';
    
    // Get session
    const session = await getIndustrialSession();
    
    // Assert authorization
    const user = await ensureIndustrialAccess('admin'); // Throws error if unauthorized
    ```

*   **Client Components**:
    ```tsx
    'use client';
    
    import { useSession } from '@ajabadia/satellite-sdk';
    
    export default function Dashboard() {
      const { session, status } = useSession();
      
      if (status === 'loading') return <p>Loading...</p>;
      
      return <h1>Hello, {session.user?.name}</h1>;
    }
    ```

---

## 📝 Structured Logging & PII Redaction

The SDK includes a centralized structured logger designed for SOC2/GDPR compliance. It automatically logs in JSON format and redacts sensitive PII (Personal Identifiable Information) recursively before writing to standard streams or sending to the `ABDLogs` microservice.

### Setup and Configuration

```typescript
import { configureLogger, logger } from '@ajabadia/satellite-sdk';

configureLogger({
  endpoint: process.env.LOGS_SERVICE_URL, // Defaults to http://localhost:3600/api/logs
  token: process.env.LOGS_SECRET_TOKEN,   // Microservice secret authorization token
  appId: process.env.NEXT_PUBLIC_APP_ID || 'my-app',
  minLevel: 'INFO',                       // DEBUG | INFO | WARN | ERROR
});
```

### Log Methods

```typescript
// Operational structured logging
logger.debug('Debugging local state', { rawQuery: 'SELECT *' });
logger.info('User action performed', { userId: 'u_123', meta: { email: 'john@example.com' } }); // Email is redacted to [REDACTED_EMAIL]
logger.warn('Rate limit threshold approached');
logger.error('Database connection timeout', errorInstance);

// Remote forensic/audit logging (propagates to ABDLogs)
logger.audit({
  tenantId: 'tenant-123',
  action: 'UPDATE_USER',
  entityType: 'USER',
  entityId: 'u-456',
  userId: 'u-admin',
  userEmail: 'admin@company.com', // Keeps root identity intact
  changedFields: {
    phoneNumber: '555-1234',      // Redacted internally
    name: 'New Name',
  },
  previousState: {
    phoneNumber: '555-0000',      // Redacted internally
    name: 'Old Name',
  },
});
```

---

## 🎨 Theme Injection Specs
The SDK outputs the CSS variables compatible with Tailwind CSS v4 in real-time, resolving subdomain metadata and reading theme overrides. Colors are loaded seamlessly through HSL values mapped to `var(--primary)`, `var(--secondary)`, and `var(--background)`.

