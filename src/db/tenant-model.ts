/**
 * @purpose Gestiona y proporciona contexto para conexiones y modelos MongoDB específicos de inquilinos.
 * @purpose_en Manages and provides a context for tenant-specific MongoDB connections and models.
 * @refactorable true (contains too many state variables and UI parts)
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:4,imports:6,sig:f4bqef
 * @lastUpdated 2026-06-23T20:30:56.354Z
 */

import mongoose, { Connection, Schema, Model } from 'mongoose';
import { getIndustrialSession } from '../auth-middleware/session';
import { tenantStorage } from './tenant-context';
import type { TenantContext } from './tenant-context';
import { getTenantConnection, ensureConnectionReady } from './tenant-connection';
import { getAuthConnectionSync, getLogsConnectionSync } from './mongodb';

export type { TenantContext } from './tenant-context';
export { tenantStorage } from './tenant-context';
export { resolveTenantUri, getTenantConnection, ensureConnectionReady } from './tenant-connection';

export async function withTenantContext<T>(callback: () => Promise<T>, explicitContext?: TenantContext): Promise<T> {
  const activeStore = tenantStorage.getStore();
  if (activeStore) { await ensureConnectionReady(getTenantConnection(activeStore.dbPrefix, activeStore.isolationStrategy)); return callback(); }
  if (explicitContext) { await ensureConnectionReady(getTenantConnection(explicitContext.dbPrefix, explicitContext.isolationStrategy)); return tenantStorage.run(explicitContext, callback); }
  try {
    const session = await getIndustrialSession();
    if (session?.authenticated && session.user?.tenantId) {
      const dbPrefix = session.user.dbPrefix || session.user.tenantId.toLowerCase().replace(/[^a-z0-9]/g, '');
      const context: TenantContext = { tenantId: session.user.tenantId, dbPrefix, isolationStrategy: session.user.isolationStrategy || 'COLLECTION_PREFIX' };
      await ensureConnectionReady(getTenantConnection(context.dbPrefix, context.isolationStrategy));
      return tenantStorage.run(context, callback);
    }
  } catch (err) { console.warn('[TenantContext] Failed to get session:', err); }
  return callback();
}

function compileModelOnConnection<T>(conn: Connection, modelName: string, schema: Schema<T>, collectionName?: string): Model<T> {
  if (conn.models[modelName]) return conn.models[modelName] as Model<T>;
  return conn.model<T>(modelName, schema, collectionName);
}

function getModelForTenant<T>(dbPrefix: string, isolationStrategy: string, modelName: string, schema: Schema<T>, defaultCollectionName: string): Model<T> {
  const conn = getTenantConnection(dbPrefix, isolationStrategy);
  const collectionName = isolationStrategy === 'COLLECTION_PREFIX' ? `${dbPrefix}_${defaultCollectionName}` : defaultCollectionName;
  return compileModelOnConnection(conn, modelName, schema, collectionName);
}

export function getTenantModel<T>(modelName: string, schema: Schema<T>): Model<T> {
  const defaultModel = mongoose.models[modelName] as Model<T> || mongoose.model<T>(modelName, schema);
  const defaultCollectionName = defaultModel.collection.name;
  return new Proxy(defaultModel, {
    get(target, prop, receiver) {
      const store = tenantStorage.getStore();
      if (!store) return Reflect.get(target, prop, receiver);
      const tenantModel = getModelForTenant(store.dbPrefix, store.isolationStrategy, modelName, schema, defaultCollectionName);
      const value = Reflect.get(tenantModel, prop);
      return typeof value === 'function' ? value.bind(tenantModel) : value;
    },
    construct(target, args, newTarget) {
      const store = tenantStorage.getStore();
      if (!store) return Reflect.construct(target, args, newTarget);
      const tenantModel = getModelForTenant(store.dbPrefix, store.isolationStrategy, modelName, schema, defaultCollectionName);
      return Reflect.construct(tenantModel as unknown as new (...args: unknown[]) => unknown, args, newTarget);
    }
  }) as unknown as Model<T>;
}

export function getGlobalModel<T>(modelName: string, schema: Schema<T>, clusterTarget: 'AUTH' | 'LOGS'): Model<T> {
  let compiledModel: Model<T> | null = null;

  const getModelLazy = (): Model<T> => {
    if (compiledModel) return compiledModel;
    const conn: Connection = clusterTarget === 'AUTH' ? getAuthConnectionSync() : getLogsConnectionSync();
    if (conn.models[modelName]) {
      compiledModel = conn.models[modelName] as Model<T>;
    } else {
      compiledModel = conn.model<T>(modelName, schema);
    }
    return compiledModel;
  };

  const dummyTarget = (() => {}) as unknown as Model<T>;

  return new Proxy(dummyTarget, {
    get(target, prop, receiver) {
      // Avoid triggering connection for typical runtime check or utility properties if possible
      if (prop === 'then' || prop === 'constructor' || prop === 'prototype') {
        return Reflect.get(target, prop, receiver);
      }
      const model = getModelLazy();
      const value = Reflect.get(model, prop);
      return typeof value === 'function' ? value.bind(model) : value;
    },
    construct(target, args, newTarget) {
      const model = getModelLazy();
      return Reflect.construct(model as unknown as new (...args: unknown[]) => unknown, args, newTarget);
    },
    apply(target, thisArg, argumentsList) {
      const model = getModelLazy();
      return Reflect.apply(model as unknown as Function, thisArg, argumentsList);
    }
  }) as unknown as Model<T>;
}

