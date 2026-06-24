/**
 * @purpose Gestiona información contextual sobre el inquilino activo durante el procesamiento de solicitudes utilizando `AsyncLocalStorage`.
 * @purpose_en Manages contextual information about the active tenant during request processing using `AsyncLocalStorage`.
 * @refactorable false
 * @classification Context/Provider
 * @complexity Low
 * @fingerprint exports:2,imports:1,sig:bqrhv2
 * @lastUpdated 2026-06-23T23:24:21.253Z
 */

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
