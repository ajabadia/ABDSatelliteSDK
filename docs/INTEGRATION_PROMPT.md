# AI Integration Prompt: `@abd/satellite-sdk`

Copy and paste this prompt when instructing an AI agent or developer to integrate the centralized SDK into a new Next.js satellite application.

---

```markdown
# SYSTEM INSTRUCTION: Integrate @abd/satellite-sdk into Next.js App

You are tasked with integrating the centralized security and branding SDK (@abd/satellite-sdk) into this Next.js satellite application. Follow these instructions strictly:

## 1. Dependency Installation
Add the SDK and styles package as dependencies:
```bash
pnpm add @abd/satellite-sdk
# Ensure @abd/styles is also installed
pnpm add github:ajabadia/ABDStyles#main --legacy-peer-deps
```

## 2. Environment Variables (.env)
Ensure the following variables are configured:
```env
NEXT_PUBLIC_APP_ID="your-satellite-slug"
AUTH_CLIENT_ID="your-client-id"
AUTH_CLIENT_SECRET="your-super-secret-client-key"
AUTH_JWT_SECRET="the-shared-suite-cryptographic-jwt-secret"
AUTH_PROVIDER_URL="https://abd-auth.vercel.app"
```

## 3. Configure the Next.js 16 Proxy Guard (src/proxy.ts)
Instead of standard middleware.ts, create `src/proxy.ts` exporting a `proxy` function wrapped with `withIndustrialAuth`:
```typescript
import { withIndustrialAuth } from '@abd/satellite-sdk';
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

## 4. Setup Dynamic API Routes (src/app/api/auth/[...auth]/route.ts)
Create a dynamic catch-all route to handle callbacks, logouts, and session status requests:
```typescript
import { createAuthRouteHandler } from '@abd/satellite-sdk';

const handler = createAuthRouteHandler({
  appId: process.env.NEXT_PUBLIC_APP_ID!,
  clientId: process.env.AUTH_CLIENT_ID!,
  clientSecret: process.env.AUTH_CLIENT_SECRET!,
  jwtSecret: process.env.AUTH_JWT_SECRET!,
});

export { handler as GET, handler as POST };
```

## 5. Implement Root Layout Styling & Provider (src/app/[locale]/layout.tsx)
Wrap the layout structure with `<SessionProvider>` and inject dynamic White-Label variables in the head utilizing `<BrandingStyles />`:
```tsx
import { BrandingStyles, SessionProvider, getIndustrialSession } from '@abd/satellite-sdk';

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

## 6. Accessing Session Context

*   **Server Components & APIs**:
    Use `getIndustrialSession()` or assert access using `ensureIndustrialAccess(role)`:
    ```typescript
    import { getIndustrialSession, ensureIndustrialAccess } from '@abd/satellite-sdk';
    
    export default async function ServerPage() {
      // Assert access (throws error if unauthorized, automatically handled by proxy)
      const user = await ensureIndustrialAccess('student');
      
      return <div>Welcome back, {user.name}</div>;
    }
    ```

*   **Client Components**:
    Use the client hook `useSession()`:
    ```tsx
    'use client';
    
    import { useSession } from '@abd/satellite-sdk';
    
    export default function ClientView() {
      const { session, status } = useSession();
      
      if (status === 'loading') return <span>Fetching telemetry...</span>;
      
      return <span>User: {session.user?.email}</span>;
    }
    ```
```
