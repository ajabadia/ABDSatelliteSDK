'use client';

/**
 * @purpose Proporciona un proveedor de sesión y un logger para uso en la aplicación.
 * @purpose_en Exports a session provider and a logger for use in the application.
 * @refactorable false
 * @classification Context/Provider
 * @complexity Low
 * @fingerprint exports:0,imports:0,sig:1yu11s3
 * @lastUpdated 2026-06-23T20:30:43.580Z
 */

export { SessionProvider, useSession } from './client/useSession';
export { logger } from './logger/index';
