import mongoose, { Connection } from 'mongoose';
import { tenantStorage } from '../db/tenant-context';
import { getTenantConnection, ensureConnectionReady } from '../db/tenant-connection';

/**
 * 🔗 Conecta a MongoDB con caching global y soporte multi-tenant y multi-cluster.
 *
 * Mantiene conexiones separadas para DATA (Multi-Tenant), AUTH (Global) y LOGS (Global).
 */

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  authConn: Connection | null;
  authPromise: Promise<Connection> | null;
  logsConn: Connection | null;
  logsPromise: Promise<Connection> | null;
}

/** Global cache for mongoose connection across hot reloads */
const globalWithMongoose = global as { __mongoose?: MongooseCache };
const cached: MongooseCache = globalWithMongoose.__mongoose || { 
  conn: null, promise: null, 
  authConn: null, authPromise: null, 
  logsConn: null, logsPromise: null 
};

if (!globalWithMongoose.__mongoose) {
  globalWithMongoose.__mongoose = cached;
}

const opts = {
  bufferCommands: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

export async function connectDB(serviceName?: string): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI || '';

  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      const name = serviceName || process.env.NEXT_PUBLIC_APP_ID || 'satellite-app';
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] ${name} MongoDB connected to DATA Cluster`);
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

export async function connectAuthDB(serviceName?: string): Promise<Connection> {
  const URI = process.env.MONGODB_AUTH_URI || process.env.MONGODB_URI || '';
  if (!URI) throw new Error('Missing MONGODB_AUTH_URI or MONGODB_URI');

  if (cached.authConn) return cached.authConn;

  if (!cached.authPromise) {
    const conn = mongoose.createConnection(URI, opts);
    cached.authPromise = ensureConnectionReady(conn).then(() => {
      if (process.env.NODE_ENV !== 'production') console.log(`[DEV] MongoDB connected to AUTH Cluster`);
      return conn;
    });
  }

  try {
    cached.authConn = await cached.authPromise;
  } catch (e) {
    cached.authPromise = null;
    throw e;
  }
  return cached.authConn;
}

export async function connectLogsDB(serviceName?: string): Promise<Connection> {
  const URI = process.env.MONGODB_LOGS_URI || process.env.MONGODB_URI || '';
  if (!URI) throw new Error('Missing MONGODB_LOGS_URI or MONGODB_URI');

  if (cached.logsConn) return cached.logsConn;

  if (!cached.logsPromise) {
    const conn = mongoose.createConnection(URI, opts);
    cached.logsPromise = ensureConnectionReady(conn).then(() => {
      if (process.env.NODE_ENV !== 'production') console.log(`[DEV] MongoDB connected to LOGS Cluster`);
      return conn;
    });
  }

  try {
    cached.logsConn = await cached.logsPromise;
  } catch (e) {
    cached.logsPromise = null;
    throw e;
  }
  return cached.logsConn;
}

export function getAuthConnectionSync(): Connection {
  if (cached.authConn) return cached.authConn;
  
  const URI = process.env.MONGODB_AUTH_URI || process.env.MONGODB_URI || '';
  if (!URI) throw new Error('Missing MONGODB_AUTH_URI or MONGODB_URI');

  if (!cached.authPromise) {
    const conn = mongoose.createConnection(URI, opts);
    cached.authConn = conn;
    cached.authPromise = ensureConnectionReady(conn).then(() => {
      if (process.env.NODE_ENV !== 'production') console.log(`[DEV] MongoDB connected to AUTH Cluster`);
      return conn;
    });
  }
  return cached.authConn!;
}

export function getLogsConnectionSync(): Connection {
  if (cached.logsConn) return cached.logsConn;
  
  const URI = process.env.MONGODB_LOGS_URI || process.env.MONGODB_URI || '';
  if (!URI) throw new Error('Missing MONGODB_LOGS_URI or MONGODB_URI');

  if (!cached.logsPromise) {
    const conn = mongoose.createConnection(URI, opts);
    cached.logsConn = conn;
    cached.logsPromise = ensureConnectionReady(conn).then(() => {
      if (process.env.NODE_ENV !== 'production') console.log(`[DEV] MongoDB connected to LOGS Cluster`);
      return conn;
    });
  }
  return cached.logsConn!;
}

export default connectDB;
