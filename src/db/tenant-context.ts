import { AsyncLocalStorage } from 'async_hooks';

/**
 * Contextual information about the active tenant during request processing.
 */
export interface TenantContext {
  tenantId: string;
  dbPrefix: string;
  isolationStrategy: string; // 'DATABASE_PER_TENANT' | 'COLLECTION_PREFIX'
}

/**
 * AsyncLocalStorage instance to hold the current TenantContext per request/callback.
 */
export const tenantStorage = new AsyncLocalStorage<TenantContext>();
