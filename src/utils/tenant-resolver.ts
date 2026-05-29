import mongoose from 'mongoose';
import { connectDB } from './mongodb';
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

  // Ensure the default mongoose connection is ready
  await connectDB();

  const conn = mongoose.connection;
  if (conn.readyState !== 1) {
    console.warn('[TenantResolver] Default connection not ready, cannot resolve tenant');
    return undefined;
  }

  const authDbName = process.env.MONGODB_AUTH_DB || 'ABDElevators-Auth';

  try {
    // useDb returns a cached handle — no new connection created
    const authDb = conn.useDb(authDbName, { useCache: true });
    const tenantsCol = authDb.collection('tenants');

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
