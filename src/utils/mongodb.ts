import mongoose from 'mongoose';
import { tenantStorage } from '../db/tenant-context';
import { getTenantConnection, ensureConnectionReady } from '../db/tenant-connection';

/**
 * 🔗 Conecta a MongoDB con caching global y soporte multi-tenant.
 *
 * La validación de MONGODB_URI se hace al llamar a connectDB(), no al importar el módulo.
 * Esto permite que el SDK se importe en entornos que no tienen MongoDB configurado
 * (ej. tests, client-side) sin lanzar errores.
 */

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

/** Global cache for mongoose connection across hot reloads */
const globalWithMongoose = global as { __mongoose?: MongooseCache };
const cached: MongooseCache = globalWithMongoose.__mongoose || { conn: null, promise: null };

if (!globalWithMongoose.__mongoose) {
  globalWithMongoose.__mongoose = cached;
}

async function connectDB(serviceName?: string): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI || '';

  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      const name = serviceName || process.env.NEXT_PUBLIC_APP_ID || 'satellite-app';
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] ${name} MongoDB connected to Cluster`);
      }
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  // Ensure active tenant connection is ready if in a tenant context
  const store = tenantStorage.getStore();
  if (store) {
    try {
      const tenantConn = getTenantConnection(store.dbPrefix, store.isolationStrategy);
      await ensureConnectionReady(tenantConn);
    } catch (e) {
      console.error(`[MultiTenant] Failed to connect to tenant database for ${store.dbPrefix}:`, e);
      throw e;
    }
  }

  return cached.conn;
}

export default connectDB;
