/**
 * @purpose Gestiona cifrado AES-256-CBC transparente a nivel campo para campos PII especificados en esquemas Mongoose, cifrando al guardar y descifrándolo al leer.
 * @purpose_en Manages transparent field-level AES-256-CBC encryption for specified PII fields in Mongoose schemas, encrypting on save and decrypting on read.
 * @refactorable false
 * @classification Business Service
 * @complexity Medium
 * @fingerprint exports:1,imports:2,sig:vyb47i
 * @lastUpdated 2026-06-26T10:03:59.770Z
 */

/**
 * Mongoose plugin for transparent field-level AES-256-CBC encryption.
 * Encrypts specified PII fields on save, decrypts on read.
 *
 * Limitations:
 * - findOneAndUpdate / updateOne / bulkWrite skip Mongoose hooks — use save() instead.
 * - Encrypted fields cannot be used in MongoDB queries (no plaintext matching).
 */

import { Schema } from 'mongoose';
import { SecurityService } from '../core/security';

function getField(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function setField(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

export function encryptionPlugin(fieldPaths: string[]) {
  return function (schema: Schema) {
    if (!fieldPaths.length) return;

    schema.pre('save', async function () {
      try {
        const doc = this as Record<string, unknown>;
        for (const fieldPath of fieldPaths) {
          const value = getField(doc, fieldPath);
          if (value && typeof value === 'string') {
            setField(doc, fieldPath, SecurityService.encrypt(value));
          }
        }
      } catch {
        // silent fail — encryption is best-effort
      }
    });

    function decryptFields(doc: Record<string, unknown>) {
      if (!doc || typeof doc !== 'object') return;
      try {
        for (const fieldPath of fieldPaths) {
          const value = getField(doc, fieldPath);
          if (value && typeof value === 'string' && value.includes(':')) {
            const decrypted = SecurityService.decrypt(value);
            if (decrypted !== value) {
              setField(doc, fieldPath, decrypted);
            }
          }
        }
      } catch {
        // silent fail
      }
    }

    schema.post('init', function (doc) {
      decryptFields(doc as Record<string, unknown>);
    });

    schema.post('find', function (docs) {
      if (!Array.isArray(docs)) return;
      for (const doc of docs) {
        decryptFields(doc as Record<string, unknown>);
      }
    });
  };
}
