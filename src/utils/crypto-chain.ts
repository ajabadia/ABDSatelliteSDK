/**
 * @purpose Gestiona el hash SHA-256 inmutable de un bloque en una cadena auditiva forense mediante serialización determinista.
 * @purpose_en Calculates the immutable SHA-256 hash of a block in an audit forensic chain using deterministic serialization.
 * @refactorable false
 * @classification Helper Utility
 * @complexity Low
 * @fingerprint exports:1,imports:2,sig:1dno38r
 * @lastUpdated 2026-06-23T23:25:16.146Z
 */

import crypto from 'crypto';
import stringify from 'fast-json-stable-stringify';

/**
 * 🔐 computeBlockHash
 * Calcula el sello SHA-256 inmutable de un bloque en la cadena de auditoría forense.
 * Utiliza serialización determinista para garantizar que el mismo objeto resulte
 * en el mismo string JSON siempre.
 *
 * @param payload - Datos puros del log excluyendo metadatos de cadena (_id, hash, previousHash, __v)
 * @param previousHash - Hash del bloque inmediatamente anterior
 * @param timestamp - Timestamp en milisegundos de la creación del bloque (Date.now())
 */
export function computeBlockHash(
  payload: Record<string, unknown>,
  previousHash: string,
  timestamp?: number
): string {
  const payloadString = stringify(payload);
  const entropy = timestamp
    ? `${previousHash}${payloadString}${timestamp}`
    : `${previousHash}${payloadString}`;
  return crypto.createHash('sha256').update(entropy).digest('hex');
}
