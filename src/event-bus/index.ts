/**
 * @purpose Proporciona funciones y tipos para crear publicadores y consumidores de eventos.
 * @purpose_en Exports functions and types for creating event publishers and consumers.
 * @refactorable false
 * @classification Type Definition
 * @complexity Low
 * @fingerprint exports:1,imports:0,sig:e0eyqr
 * @lastUpdated 2026-06-25T09:21:40.760Z
 */

export { createPublisher } from './publisher';
export { createConsumer } from './consumer';
export type { EventEnvelope, EventHandler, EventBusConfig } from './types';
export { SystemEventType } from '../auth-middleware/events';
