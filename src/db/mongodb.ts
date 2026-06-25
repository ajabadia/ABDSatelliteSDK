/**
 * @purpose Gestiona conexiones MongoDB para el ABDSatelliteSDK, proporcionando un patrón de singleton para garantizar una conexión única por servicio y manejar configuraciones multi-tenant.
 * @purpose_en Manages MongoDB connections for the ABDSatelliteSDK, providing a singleton pattern to ensure only one connection per service and handling multi-tenant configurations.
 * @refactorable true (contains multiple functions with specific responsibilities)
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:5,imports:3,sig:15n42k4
 * @lastUpdated 2026-06-23T20:33:08.498Z
 */

import mongoose, { Connection } from 'mongoose';
import { tenantStorage } from './tenant-context';
import { getTenantConnection, ensureConnectionReady } from './tenant-connection';

interface MongooseCache {
  conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null;
  authConn: Connection | null; authPromise: Promise<Connection> | null;
  logsConn: Connection | null; logsPromise: Promise<Connection> | null;
}

const g = global as { __mongoose?: MongooseCache };
const cached: MongooseCache = g.__mongoose || { conn: null, promise: null, authConn: null, authPromise: null, logsConn: null, logsPromise: null };
if (!g.__mongoose) g.__mongoose = cached;

const opts = { bufferCommands: false, maxPoolSize: 10, serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000 };

export async function connectDB(serviceName?: string): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI || '';
  if (!MONGODB_URI) throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      if (process.env.NODE_ENV !== 'production') console.log(`[DEV] ${serviceName || process.env.NEXT_PUBLIC_APP_ID || 'satellite-app'} MongoDB connected to DATA Cluster`);
      return mongooseInstance;
    });
  }
  try { cached.conn = await cached.promise; } catch (e) { cached.promise = null; throw e; }
  const store = tenantStorage.getStore();
  if (store) {
    try { await ensureConnectionReady(getTenantConnection(store.dbPrefix, store.isolationStrategy)); }
    catch (e) { console.error(`[MultiTenant] Failed to connect to tenant database for ${store.dbPrefix}:`, e); throw e; }
  }
  return cached.conn;
}

async function connectCluster(key: 'auth' | 'logs', URI: string, cacheKey: 'authConn' | 'logsConn', promiseKey: 'authPromise' | 'logsPromise', label: string): Promise<Connection> {
  if (cached[cacheKey]) return cached[cacheKey];
  if (!cached[promiseKey]) {
    const conn = mongoose.createConnection(URI, opts);
    cached[promiseKey] = ensureConnectionReady(conn).then(() => {
      if (process.env.NODE_ENV !== 'production') console.log(`[DEV] MongoDB connected to ${label} Cluster`);
      return conn;
    });
  }
  try { cached[cacheKey] = await cached[promiseKey]; } catch (e) { cached[promiseKey] = null; throw e; }
  return cached[cacheKey];
}

export async function connectAuthDB(serviceName?: string): Promise<Connection> {
  return connectCluster('auth', process.env.MONGODB_AUTH_URI || process.env.MONGODB_URI || '', 'authConn', 'authPromise', 'AUTH');
}

export async function connectLogsDB(serviceName?: string): Promise<Connection> {
  return connectCluster('logs', process.env.MONGODB_LOGS_URI || process.env.MONGODB_URI || '', 'logsConn', 'logsPromise', 'LOGS');
}

function getConnectionSync(cacheKey: 'authConn' | 'logsConn', promiseKey: 'authPromise' | 'logsPromise', envVar: string, label: string): Connection {
  if (cached[cacheKey]) return cached[cacheKey]!;
  const URI = process.env[envVar] || process.env.MONGODB_URI || '';
  if (!URI) throw new Error(`Missing ${envVar} or MONGODB_URI`);
  if (!cached[promiseKey]) {
    const conn = mongoose.createConnection(URI, opts);
    cached[cacheKey] = conn;
    cached[promiseKey] = ensureConnectionReady(conn).then(() => {
      if (process.env.NODE_ENV !== 'production') console.log(`[DEV] MongoDB connected to ${label} Cluster`);
      return conn;
    });
  }
  return cached[cacheKey]!;
}

export function getAuthConnectionSync(): Connection { return getConnectionSync('authConn', 'authPromise', 'MONGODB_AUTH_URI', 'AUTH'); }
export function getLogsConnectionSync(): Connection { return getConnectionSync('logsConn', 'logsPromise', 'MONGODB_LOGS_URI', 'LOGS'); }
export default connectDB;
