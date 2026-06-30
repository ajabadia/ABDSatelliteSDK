/**
 * @purpose Gestiona interfaces para envolturas de eventos, manejadores de eventos y configuraciones del bus de eventos.
 * @purpose_en Defines interfaces for event envelopes, event handlers, and event bus configurations.
 * @refactorable false
 * @classification Type Definition
 * @complexity Low
 * @fingerprint exports:5,imports:0,sig:qb9wky
 * @lastUpdated 2026-06-30T13:01:47.022Z
 */

export interface EventEnvelope {
  id: string;
  type: string;
  source: string;
  subject?: string;
  data: Record<string, unknown>;
  timestamp: string;
  schemaVersion: number;
}

export interface EventHandler {
  (event: EventEnvelope): Promise<void> | void;
}

export interface EventBusConfig {
  source: string;
  pollIntervalMs?: number;
  fallbackStorage?: (envelope: EventEnvelope) => Promise<void>;
  validateSchema?: boolean;
}

export interface StreamInfo {
  eventType: string;
  streamKey: string;
  length: number;
}

export interface StreamEventEntry {
  id: string;
  data: Record<string, unknown>;
  timestamp: string;
}
