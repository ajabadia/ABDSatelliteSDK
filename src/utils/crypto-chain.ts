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
