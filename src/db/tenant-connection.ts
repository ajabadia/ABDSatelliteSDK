import mongoose, { Connection } from 'mongoose';

// ── LRU cache for tenant connections (survives HMR via global) ──
interface CachedConnection {
  connection: Connection;
  lastUsed: number;
}

interface TenantConnectionCache {
  [key: string]: CachedConnection;
}

const globalWithTenantConnections = global as typeof globalThis & {
  tenantConnections?: TenantConnectionCache;
};

if (!globalWithTenantConnections.tenantConnections) {
  globalWithTenantConnections.tenantConnections = {};
}

const connectionPool = globalWithTenantConnections.tenantConnections;

// ── Helpers ───────────────────────────────────────────────

/**
 * Resolves the MongoDB URI for a specific tenant database.
 */
export function resolveTenantUri(baseUri: string, dbName: string): string {
  const protocolMatch = baseUri.match(/^mongodb(?:\+srv)?:\/\//);
  if (!protocolMatch) {
    throw new Error('Invalid MONGODB_URI protocol');
  }
  const protocol = protocolMatch[0];
  const remaining = baseUri.substring(protocol.length);

  const qIndex = remaining.indexOf('?');
  const hostAndDb = qIndex === -1 ? remaining : remaining.substring(0, qIndex);
  const options = qIndex === -1 ? '' : remaining.substring(qIndex);

  const slashIndex = hostAndDb.lastIndexOf('/');

  if (slashIndex === -1) {
    return `${protocol}${hostAndDb}/${dbName}${options}`;
  } else {
    const hostPart = hostAndDb.substring(0, slashIndex);
    return `${protocol}${hostPart}/${dbName}${options}`;
  }
}

/**
 * Gets or creates a cached Mongoose Connection for a tenant.
 * Incorporates LRU eviction when pool exceeds 15 connections.
 */
export function getTenantConnection(dbPrefix: string, isolationStrategy: string): Connection {
  const cacheKey = isolationStrategy === 'DATABASE_PER_TENANT'
    ? `DB_PER_TENANT:${dbPrefix}`
    : `COLL_PREFIX:${dbPrefix}`;

  if (connectionPool[cacheKey]) {
    connectionPool[cacheKey].lastUsed = Date.now();
    return connectionPool[cacheKey].connection;
  }

  // LRU eviction — prevent descriptor leaks in long-running processes
  const keys = Object.keys(connectionPool);
  if (keys.length >= 15) {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const key of keys) {
      if (connectionPool[key].lastUsed < oldestTime) {
        oldestTime = connectionPool[key].lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const evicted = connectionPool[oldestKey];
      delete connectionPool[oldestKey];
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[MultiTenant] Evicting LRU connection from cache: ${oldestKey}`);
      }
      evicted.connection.close().catch((err: unknown) => {
        console.error(`[MultiTenant] Error closing evicted connection ${oldestKey}:`, err);
      });
    }
  }

  const baseUri = process.env.MONGODB_URI || '';
  if (!baseUri) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
  }

  let targetUri = baseUri;
  if (isolationStrategy === 'DATABASE_PER_TENANT') {
    const dbName = `abd_tenant_${dbPrefix}`;
    targetUri = resolveTenantUri(baseUri, dbName);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[MultiTenant] Creating connection for ${cacheKey} (Strategy: ${isolationStrategy})`);
  }

  const opts = {
    bufferCommands: false,
    maxPoolSize: 3,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  const conn = mongoose.createConnection(targetUri, opts);

  conn.on('connected', () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[MultiTenant] Connection established for ${cacheKey}`);
    }
  });
  conn.on('error', (err: unknown) => {
    console.error(`[MultiTenant] Connection error for ${cacheKey}:`, err);
  });

  connectionPool[cacheKey] = {
    connection: conn,
    lastUsed: Date.now(),
  };
  return conn;
}

/**
 * Awaits a Mongoose Connection to be ready (readyState === 1).
 */
export async function ensureConnectionReady(conn: Connection): Promise<Connection> {
  if (conn.readyState === 1) {
    return conn;
  }
  if (conn.readyState === 2) {
    await new Promise<void>((resolve, reject) => {
      const onConnected = () => {
        conn.removeListener('error', onError);
        resolve();
      };
      const onError = (err: Error) => {
        conn.removeListener('connected', onConnected);
        reject(err);
      };
      conn.once('connected', onConnected);
      conn.once('error', onError);
    });
    return conn;
  }
  await conn.asPromise();
  return conn;
}
