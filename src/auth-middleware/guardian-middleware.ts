/**
 * @purpose Valida el acceso del usuario a los recursos según las acciones y políticas utilizando el motor Guardian en la gobernanza de inquilinos.
 * @purpose_en Validates user access to resources based on actions and policies using the Guardian Engine in Tenant Governance.
 * @refactorable true (contains too many state variables and UI parts)
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:2,imports:4,sig:6438py
 * @lastUpdated 2026-06-26T10:03:40.965Z
 */

/**
 * ABAC authorization middleware for Next.js API App Router routes.
 * Evaluates access against the centralized Guardian Engine in Tenant Governance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { evaluateAccess, type EvaluateAccessParams } from '../utils/guardian';
import { getIndustrialSession } from './session';
import { getCache, setCache } from './session/redis-store';

export interface GuardianAccessOptions {
  resource: string | ((req: NextRequest) => string);
  action: string | ((req: NextRequest) => string);
  context?: Record<string, unknown> | ((req: NextRequest) => Record<string, unknown>);
  cacheTtlSeconds?: number;
}

type ApiHandler = (req: NextRequest, context?: { params?: Promise<Record<string, string>> }) => Promise<NextResponse>;

function resolveValue<T>(value: T | ((req: NextRequest) => T), req: NextRequest): T {
  return typeof value === 'function' ? (value as (req: NextRequest) => T)(req) : value;
}

function cacheKey(tenantId: string, userId: string, resource: string, action: string): string {
  return `guardian:${tenantId}:${userId}:${resource}:${action}`;
}

export function withGuardianAccess(options: GuardianAccessOptions) {
  const cacheTtl = options.cacheTtlSeconds ?? 300;

  return function (handler: ApiHandler): ApiHandler {
    return async function (req: NextRequest, context?: { params?: Promise<Record<string, string>> }) {
      const resource = resolveValue(options.resource, req);
      const action = resolveValue(options.action, req);
      const contextMeta = resolveValue(options.context, req);

      const session = await getIndustrialSession();
      if (!session.authenticated || !session.user) {
        return NextResponse.json(
          { error: 'UNAUTHENTICATED', message: 'Authentication required' },
          { status: 401 }
        );
      }

      const { tenantId, id: userId } = session.user;
      const ck = cacheKey(tenantId, userId, resource, action);
      const cached = await getCache<{ allowed: boolean; reason: string }>(ck);
      if (cached) {
        if (!cached.allowed) {
          return NextResponse.json(
            { error: 'ACCESS_DENIED', reason: cached.reason, resource, action },
            { status: 403 }
          );
        }
        return handler(req, context);
      }

      const params: EvaluateAccessParams = {
        tenantId,
        userId,
        resource,
        action,
        context: { ...contextMeta, userRole: session.user.role, userEmail: session.user.email },
      };

      const result = await evaluateAccess(params);

      await setCache(ck, { allowed: result.allowed, reason: result.reason }, cacheTtl);

      if (!result.allowed) {
        return NextResponse.json(
          { error: 'ACCESS_DENIED', reason: result.reason, resource, action },
          { status: 403 }
        );
      }

      return handler(req, context);
    };
  };
}
