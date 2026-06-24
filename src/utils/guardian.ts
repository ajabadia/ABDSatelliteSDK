/**
 * @purpose Gestiona permisos de acceso basados en políticas ABAC utilizando un motor Guardian Centralizado.
 * @purpose_en Evaluates access permissions based on ABAC policies using a centralized Guardian Engine.
 * @refactorable false
 * @classification Business Service
 * @complexity Low
 * @fingerprint exports:3,imports:0,sig:qutxgd
 * @lastUpdated 2026-06-23T23:25:31.332Z
 */

/**
 * 🛰️ Centralized Guardian ABAC Evaluation Client
 * Connects dynamically to the Tenant Governance control plane.
 */

export interface EvaluateAccessParams {
  tenantId: string;
  userId: string;
  resource: string;
  action: string;
  context?: Record<string, unknown>;
}

export interface EvaluateAccessResult {
  allowed: boolean;
  reason: string;
  allowedSpaceIds: string[];
  allowedGroupIds: string[];
}

/**
 * Queries the centralized Guardian Engine to evaluate access permissions.
 * Defaults to secure DENY on connectivity or configuration failures.
 */
export async function evaluateAccess(params: EvaluateAccessParams): Promise<EvaluateAccessResult> {
  const internalSecret = process.env.ABD_INTERNAL_SECRET;
  if (!internalSecret) {
    console.warn('[ABAC_SDK_WARN] ABD_INTERNAL_SECRET is not configured. Access denied by default.');
    return {
      allowed: false,
      reason: 'SDK_SECRET_MISSING',
      allowedSpaceIds: [],
      allowedGroupIds: []
    };
  }

  const governanceUrl = process.env.GOVERNANCE_API_URL || 'http://localhost:5002';

  try {
    const response = await fetch(`${governanceUrl}/api/internal/guardian/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-abd-internal-secret': internalSecret
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ABAC_SDK_ERROR] Guardian API returned status ${response.status}: ${errorText}`);
      return {
        allowed: false,
        reason: `GUARDIAN_API_STATUS_${response.status}`,
        allowedSpaceIds: [],
        allowedGroupIds: []
      };
    }

    return (await response.json()) as EvaluateAccessResult;
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[ABAC_SDK_ERROR] Failed to query Guardian evaluate endpoint:', err.message || err);
    return {
      allowed: false,
      reason: 'GUARDIAN_API_UNREACHABLE',
      allowedSpaceIds: [],
      allowedGroupIds: []
    };
  }
}
