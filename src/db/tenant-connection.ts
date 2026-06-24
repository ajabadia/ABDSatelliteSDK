/**
 * @purpose Gestiona y proporciona conexiones MongoDB para diferentes inquilinos según la estrategia de aislamiento.
 * @purpose_en Manages and provides MongoDB connections for different tenants based on the isolation strategy.
 * @refactorable true (contains multiple functions with distinct responsibilities)
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:3,imports:1,sig:1c8i09u
 * @lastUpdated 2026-06-23T20:30:48.735Z
 */

import mongoose, { Connection } from 'mongoose';

interface CachedConnection { connection: Connection; lastUsed: number; }
interface TenantConnectionCache { [key: string]: CachedConnection; }

const g = global as typeof globalThis & { tenantConnections?: TenantConnectionCache };
if (!g.tenantConnections) g.tenantConnections = {};
const connectionPool = g.tenantConnections;

export function resolveTenantUri(baseUri: string, dbName: string): string {
  const protocolMatch = baseUri.match(/^mongodb(?:\+srv)?:\/\//);
  if (!protocolMatch) throw new Error('Invalid MONGODB_URI protocol');
  const protocol = protocolMatch[0];
  const remaining = baseUri.substring(protocol.length);
  const qIndex = remaining.indexOf('?');
  const hostAndDb = qIndex === -1 ? remaining : remaining.substring(0, qIndex);
  const options = qIndex === -1 ? '' : remaining.substring(qIndex);
  const slashIndex = hostAndDb.lastIndexOf('/');
  if (slashIndex === -1) return `${protocol}${hostAndDb}/${dbName}${options}`;
  return `${protocol}${hostAndDb.substring(0, slashIndex)}/${dbName}${options}`;
}

export function getTenantConnection(dbPrefix: string, isolationStrategy: string): Connection {
  const cacheKey = isolationStrategy === 'DATABASE_PER_TENANT' ? `DB_PER_TENANT:${dbPrefix}` : `COLL_PREFIX:${dbPrefix}`;
  if (connectionPool[cacheKey]) { connectionPool[cacheKey].lastUsed = Date.now(); return connectionPool[cacheKey].connection; }

  const keys = Object.keys(connectionPool);
  if (keys.length >= 15) {
    let oldestKey = '', oldestTime = Infinity;
    for (const key of keys) { if (connectionPool[key].lastUsed < oldestTime) { oldestTime = connectionPool[key].lastUsed; oldestKey = key; } }
    if (oldestKey) {
      const evicted = connectionPool[oldestKey];
      delete connectionPool[oldestKey];
      if (process.env.NODE_ENV !== 'production') console.log(`[MultiTenant] Evicting LRU connection: ${oldestKey}`);
      evicted.connection.close().catch((err: unknown) => console.error(`[MultiTenant] Error closing evicted connection ${oldestKey}:`, err));
    }
  }

  const baseUri = process.env.MONGODB_URI || '';
  if (!baseUri) throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
  let targetUri = baseUri;
  if (isolationStrategy === 'DATABASE_PER_TENANT') targetUri = resolveTenantUri(baseUri, `abd_tenant_${dbPrefix}`);
  if (process.env.NODE_ENV !== 'production') console.log(`[MultiTenant] Creating connection for ${cacheKey} (Strategy: ${isolationStrategy})`);

  const opts = { bufferCommands: false, maxPoolSize: 3, serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000 };
  const conn = mongoose.createConnection(targetUri, opts);
  conn.on('connected', () => { if (process.env.NODE_ENV !== 'production') console.log(`[MultiTenant] Connection established for ${cacheKey}`); });
  conn.on('error', (err: unknown) => console.error(`[MultiTenant] Connection error for ${cacheKey}:`, err));
  connectionPool[cacheKey] = { connection: conn, lastUsed: Date.now() };
  return conn;
}

export async function ensureConnectionReady(conn: Connection): Promise<Connection> {
  if (conn.readyState === 1) return conn;
  if (conn.readyState === 2) {
    await new Promise<void>((resolve, reject) => {
      const onConnected = () => { conn.removeListener('error', onError); resolve(); };
      const onError = (err: Error) => { conn.removeListener('connected', onConnected); reject(err); };
      conn.once('connected', onConnected); conn.once('error', onError);
    });
    return conn;
  }
  await conn.asPromise();
  return conn;
}
