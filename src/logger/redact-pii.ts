/**
 * @purpose Redacta PII recursivamente de valores, incluyendo claves sensibles y patrones como direcciones de correo electrónico y números de tarjeta de crédito.
 * @purpose_en Recursively redacts Personally Identifiable Information (PII) from values, including sensitive keys and patterns like email addresses and credit card numbers.
 * @refactorable false
 * @classification Helper Utility
 * @complexity Low
 * @fingerprint exports:1,imports:0,sig:1mvqbja
 * @lastUpdated 2026-06-23T23:24:32.250Z
 */

const SENSITIVE_KEYS = [
  'password', 'token', 'secret', 'jwt', 'apikey',
  'clientsecret', 'jwtsecret', 'creditcard', 'cvv',
  'authorization', 'cookie', 'key', 'ssn', 'birthdate',
  'phone', 'phonenumber', 'tel', 'pin', 'salt', 'hash',
  'privatekey', 'passwd',
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

/** 🔒 Recursively redacts PII from values */
export function redactPII<T>(val: T, keyName?: string): T {
  if (val === null || val === undefined) return val;

  if (typeof val === 'string') {
    if (keyName && SENSITIVE_KEYS.some(k => keyName.toLowerCase().includes(k))) {
      return '[REDACTED]' as unknown as T;
    }
    let cleaned = val.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
    cleaned = cleaned.replace(CREDIT_CARD_REGEX, '[REDACTED_CARD]');
    return cleaned as unknown as T;
  }

  if (Array.isArray(val)) {
    return val.map(item => redactPII(item, keyName)) as unknown as T;
  }

  if (typeof val === 'object') {
    if (val instanceof Date || val instanceof RegExp) return val;
    const copy: Record<string, unknown> = {};
    for (const k of Object.keys(val as object)) {
      copy[k] = redactPII((val as Record<string, unknown>)[k], k);
    }
    return copy as unknown as T;
  }

  if (keyName && SENSITIVE_KEYS.some(k => keyName.toLowerCase().includes(k))) {
    return '[REDACTED]' as unknown as T;
  }

  return val;
}
