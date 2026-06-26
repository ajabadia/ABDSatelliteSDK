/**
 * @purpose Gestiona interfaces para envolturas de eventos, manejadores de eventos y configuraciones del bus de eventos.
 * @purpose_en Defines interfaces for event envelopes, event handlers, and event bus configurations.
 * @refactorable false
 * @classification Type Definition
 * @complexity Low
 * @fingerprint exports:5,imports:0,sig:fq5h5v
 * @lastUpdated 2026-06-26T10:04:06.826Z
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
