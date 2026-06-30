/**
 * @purpose Gestiona y valida esquemas de eventos para diferentes tipos de eventos.
 * @purpose_en Manages and validates event schemas for different event types.
 * @refactorable false
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:6,imports:2,sig:mm67ld
 * @lastUpdated 2026-06-30T13:00:49.047Z
 */

import { z } from 'zod/v4';
import type { EventEnvelope } from './types';

export interface SchemaEntry {
  schema: z.ZodType<unknown>;
  version: number;
  description?: string;
}

const registry = new Map<string, Map<number, SchemaEntry>>();
const latestVersion = new Map<string, number>();

export function registerSchema(
  eventType: string,
  schema: z.ZodType<unknown>,
  description?: string,
): number {
  const versions = registry.get(eventType) || new Map();
  const current = latestVersion.get(eventType) ?? 0;
  const version = current + 1;

  if (version > 1) {
    const prevSchema = versions.get(version - 1)!;
    const prevSample = prevSchema.schema.safeParse({});
    if (prevSample.success) {
      const result = schema.safeParse(prevSample.data);
      if (!result.success) {
        console.warn(
          `[SCHEMA_REGISTRY] New schema v${version} for "${eventType}" may break backward compatibility with v${version - 1}`,
        );
      }
    }
  }

  versions.set(version, { schema, version, description });
  registry.set(eventType, versions);
  latestVersion.set(eventType, version);
  return version;
}

export function getSchema(eventType: string, version?: number): SchemaEntry | null {
  const versions = registry.get(eventType);
  if (!versions) return null;

  const v = version ?? latestVersion.get(eventType) ?? 1;
  return versions.get(v) ?? null;
}

export function getLatestVersion(eventType: string): number {
  return latestVersion.get(eventType) ?? 0;
}

export function hasSchema(eventType: string): boolean {
  return registry.has(eventType);
}

export function validateEnvelope(envelope: EventEnvelope): { valid: boolean; error?: string } {
  const entry = getSchema(envelope.type, envelope.schemaVersion);
  if (!entry) {
    return {
      valid: false,
      error: `No schema registered for "${envelope.type}" v${envelope.schemaVersion}`,
    };
  }

  const result = entry.schema.safeParse(envelope.data);
  if (!result.success) {
    return { valid: false, error: result.error.message };
  }

  return { valid: true };
}
