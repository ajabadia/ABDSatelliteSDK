import mongoose, { Connection, Schema, Model } from 'mongoose';
import { getIndustrialSession } from '../session';
import { tenantStorage } from './tenant-context';
import type { TenantContext } from './tenant-context';
import { getTenantConnection, ensureConnectionReady } from './tenant-connection';

// ── Re-exports for convenience ────────────────────────────
export type { TenantContext } from './tenant-context';
export { tenantStorage } from './tenant-context';
export { resolveTenantUri, getTenantConnection, ensureConnectionReady } from './tenant-connection';

// ── Helpers ───────────────────────────────────────────────

/**
 * Runs the callback in the context of the active tenant.
 *
 * Resolves tenant identity in order of priority:
 * 1. Already-active AsyncLocalStorage store
 * 2. Explicitly provided context
 * 3. Session from `getIndustrialSession()`
 *
 * When a tenant context is established, also ensures the Mongoose connection
 * is ready before executing the callback (prevents race conditions in serverless).
 */
export async function withTenantContext<T>(
  callback: () => Promise<T>,
  explicitContext?: TenantContext
): Promise<T> {
  const activeStore = tenantStorage.getStore();
  if (activeStore) {
    const conn = getTenantConnection(activeStore.dbPrefix, activeStore.isolationStrategy);
    await ensureConnectionReady(conn);
    return callback();
  }

  if (explicitContext) {
    const conn = getTenantConnection(explicitContext.dbPrefix, explicitContext.isolationStrategy);
    await ensureConnectionReady(conn);
    return tenantStorage.run(explicitContext, callback);
  }

  try {
    const session = await getIndustrialSession();
    if (session?.authenticated && session.user?.tenantId) {
      const dbPrefix = session.user.dbPrefix || session.user.tenantId.toLowerCase().replace(/[^a-z0-9]/g, '');
      const context: TenantContext = {
        tenantId: session.user.tenantId,
        dbPrefix,
        isolationStrategy: session.user.isolationStrategy || 'COLLECTION_PREFIX',
      };
      const conn = getTenantConnection(context.dbPrefix, context.isolationStrategy);
      await ensureConnectionReady(conn);
      return tenantStorage.run(context, callback);
    }
  } catch (err) {
    console.warn('[TenantContext] Failed to get session or cookies:', err);
  }

  return callback();
}

/**
 * Compiles a Mongoose model on a given connection, preventing duplicate compilations.
 */
function compileModelOnConnection<T>(
  conn: Connection,
  modelName: string,
  schema: Schema<T>,
  collectionName?: string
): Model<T> {
  if (conn.models[modelName]) {
    return conn.models[modelName] as Model<T>;
  }
  return conn.model<T>(modelName, schema, collectionName);
}

/**
 * Resolves the tenant-specific compiled model for a given modelName and schema.
 */
function getModelForTenant<T>(
  dbPrefix: string,
  isolationStrategy: string,
  modelName: string,
  schema: Schema<T>,
  defaultCollectionName: string
): Model<T> {
  const conn = getTenantConnection(dbPrefix, isolationStrategy);

  let collectionName = defaultCollectionName;
  if (isolationStrategy === 'COLLECTION_PREFIX') {
    collectionName = `${dbPrefix}_${defaultCollectionName}`;
  }

  return compileModelOnConnection(conn, modelName, schema, collectionName);
}

/**
 * Creates a Proxy over a Mongoose model that dynamically forwards operations
 * to the tenant-specific model based on the active AsyncLocalStorage context.
 */
export function getTenantModel<T>(
  modelName: string,
  schema: Schema<T>
): Model<T> {
  const defaultModel = mongoose.models[modelName] as Model<T> || mongoose.model<T>(modelName, schema);
  const defaultCollectionName = defaultModel.collection.name;

  return new Proxy(defaultModel, {
    get(target, prop, receiver) {
      const store = tenantStorage.getStore();
      if (!store) {
        return Reflect.get(target, prop, receiver);
      }

      const tenantModel = getModelForTenant(
        store.dbPrefix,
        store.isolationStrategy,
        modelName,
        schema,
        defaultCollectionName
      );

      const value = Reflect.get(tenantModel, prop);
      if (typeof value === 'function') {
        return value.bind(tenantModel);
      }
      return value;
    },

    construct(target, args, newTarget) {
      const store = tenantStorage.getStore();
      if (!store) {
        return Reflect.construct(target, args, newTarget);
      }

      const tenantModel = getModelForTenant(
        store.dbPrefix,
        store.isolationStrategy,
        modelName,
        schema,
        defaultCollectionName
      );
      return Reflect.construct(tenantModel as unknown as new (...args: unknown[]) => unknown, args, newTarget);
    }
  }) as unknown as Model<T>;
}

/**
 * Resolves a model on a specific Global Cluster (AUTH or LOGS) synchronously.
 * Mongoose natively buffers commands until the connection is fully established.
 */
export function getGlobalModel<T>(
  modelName: string,
  schema: Schema<T>,
  clusterTarget: 'AUTH' | 'LOGS'
): Model<T> {
  const mongodbModule = require('../utils/mongodb');
  // Get the synchronous Mongoose Connection object
  const conn: mongoose.Connection = clusterTarget === 'AUTH' 
    ? mongodbModule.getAuthConnectionSync() 
    : mongodbModule.getLogsConnectionSync();
    
  if (conn.models[modelName]) {
    return conn.models[modelName] as Model<T>;
  }
  return conn.model<T>(modelName, schema);
}
