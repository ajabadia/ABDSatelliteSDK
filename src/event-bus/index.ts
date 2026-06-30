/**
 * @purpose Proporciona funciones y tipos para crear publicadores y consumidores de eventos.
 * @purpose_en Exports functions and types for creating event publishers and consumers.
 * @refactorable false
 * @classification Type Definition
 * @complexity Low
 * @fingerprint exports:2,imports:0,sig:179h0rv
 * @lastUpdated 2026-06-30T13:01:44.035Z
 */

export { createPublisher } from './publisher';
export { createConsumer } from './consumer';
export { getAllStreamInfo, getStreamRecentEvents } from './monitoring';
export {
  registerSchema,
  getSchema,
  getLatestVersion,
  hasSchema,
  validateEnvelope,
} from './schema-registry';
export type { SchemaEntry } from './schema-registry';
export type { EventEnvelope, EventHandler, EventBusConfig, StreamInfo, StreamEventEntry } from './types';
export { SystemEventType } from '../auth-middleware/events';
