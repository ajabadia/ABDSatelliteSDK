/**
 * @purpose Gestiona un TenantContext para un inquilino objetivo consultando la base de datos central de autenticación.
 * @purpose_en Resolves a TenantContext for a target tenant by querying the central auth database.
 * @refactorable false
 * @classification Business Service
 * @complexity Low
 * @fingerprint exports:1,imports:2,sig:bahhwk
 * @lastUpdated 2026-06-23T23:26:02.992Z
 */

import { connectAuthDB } from '../db/mongodb';
import type { TenantContext } from '../db/tenant-context';

/**
 * Resolves a TenantContext for a target tenant by querying the central auth database.
 *
 * This is the core function for Sprint 3.1 of the Context Shift pattern.
 * When a SUPER_ADMIN wants to act on behalf of another tenant, this function
 * looks up the tenant's `dbPrefix` and `isolationStrategy` from the central
 * `ABDElevators-Auth.tenants` collection.
 *
 * @param tenantId - The target tenant ID (e.g. from URL searchParams).
 *                   If undefined or empty, returns null (passthrough — use session context).
 * @returns A TenantContext with the correct dbPrefix/isolationStrategy, or null.
 */
export async function resolveTargetTenantContext(
  tenantId?: string
): Promise<TenantContext | undefined> {
  if (!tenantId || tenantId.trim() === '') {
    return undefined;
  }

  try {
    // Connect directly to the dedicated Auth database connection
    const authConn = await connectAuthDB();
    const tenantsCol = authConn.collection('tenants');

    const tenant = await tenantsCol.findOne(
      { tenantId, active: true },
      { projection: { tenantId: 1, dbPrefix: 1, isolationStrategy: 1 } }
    );

    if (!tenant) {
      console.warn(`[TenantResolver] Target tenant not found or inactive: ${tenantId}`);
      return undefined;
    }

    const resolved: TenantContext = {
      tenantId: tenant.tenantId as string,
      dbPrefix: (tenant.dbPrefix as string) || 'default',
      isolationStrategy: (tenant.isolationStrategy as string) || 'COLLECTION_PREFIX',
    };

    console.log(
      `[TenantResolver] Resolved context for tenant "${tenantId}":`,
      JSON.stringify(resolved)
    );

    return resolved;
  } catch (error) {
    console.error(`[TenantResolver] Failed to resolve tenant context for "${tenantId}":`, error);
    return undefined;
  }
}
