import { z } from 'zod';

export const TenantInfoSchema = z.object({
  tenantId: z.string(),
  active: z.boolean(),
  name: z.string(),
  dbPrefix: z.string(),
  isolationStrategy: z.string(),
  allowedApps: z.array(z.string()).optional(),
  branding: z.record(z.string(), z.any()).nullable().optional()
}).catchall(z.any());

export const FederatedSessionSchema = z.object({
  authenticated: z.boolean(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().default(''),
    surname: z.string().default(''),
    role: z.string(),
    tenantId: z.string(),
    permissions: z.array(z.string()).default([]),
    dbPrefix: z.string().default(''),
    isolationStrategy: z.string().default('DATABASE_PER_TENANT'),
    allowedApps: z.array(z.string()).optional(),
    sessionId: z.string().optional()
  }).optional(),
  tenantInfo: TenantInfoSchema.optional()
});

export const SessionVerifySchema = z.object({
  active: z.boolean()
});

export const TokenResponseSchema = z.object({
  token: z.string()
});

export const VerifiedTokenPayloadSchema = z.object({
  sub: z.string().optional(),
  email: z.string(),
  name: z.string().optional(),
  surname: z.string().optional(),
  role: z.string(),
  tenantId: z.string(),
  permissions: z.array(z.string()).optional(),
  dbPrefix: z.string().optional(),
  isolationStrategy: z.string().optional(),
  allowedApps: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
  iat: z.number().optional(),
  exp: z.number().optional()
}).catchall(z.any());
