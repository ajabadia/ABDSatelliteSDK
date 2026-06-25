/**
 * @purpose Gestiona interfaces para envolturas de eventos, manejadores de eventos y configuraciones del bus de eventos.
 * @purpose_en Defines interfaces for event envelopes, event handlers, and event bus configurations.
 * @refactorable false
 * @classification Type Definition
 * @complexity Low
 * @fingerprint exports:3,imports:0,sig:1x3oawg
 * @lastUpdated 2026-06-25T09:21:56.499Z
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
