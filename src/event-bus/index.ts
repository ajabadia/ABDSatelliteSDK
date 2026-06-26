/**
 * @purpose Proporciona funciones y tipos para crear publicadores y consumidores de eventos.
 * @purpose_en Exports functions and types for creating event publishers and consumers.
 * @refactorable false
 * @classification Type Definition
 * @complexity Low
 * @fingerprint exports:1,imports:0,sig:htpqmz
 * @lastUpdated 2026-06-26T10:04:04.481Z
 */

export { createPublisher } from './publisher';
export { createConsumer } from './consumer';
export { getAllStreamInfo, getStreamRecentEvents } from './monitoring';
export type { EventEnvelope, EventHandler, EventBusConfig, StreamInfo, StreamEventEntry } from './types';
export { SystemEventType } from '../auth-middleware/events';
