/**
 * @purpose Proporciona funciones y tipos relacionados con autenticación para manejar acceso industrial, gestión de sesiones y acciones de eventos.
 * @purpose_en Exports various authentication-related functions and types for handling industrial access, session management, and event actions.
 * @refactorable false
 * @classification Business Service
 * @complexity Low
 * @fingerprint exports:3,imports:0,sig:b80bjt
 * @lastUpdated 2026-06-25T09:20:34.059Z
 */

export { withIndustrialAuth } from './proxy';
export { createAuthRouteHandler } from './routeHandler';
export { getIndustrialSession, ensureIndustrialAccess, UnauthorizedAccessError, InsufficientPrivilegesError } from './session';
export { getCache, setCache, delCache, sessionCacheKey, verifyCacheKey, hashToken } from './session/redis-store';
export { withGuardianAccess } from './guardian-middleware';
export type { GuardianAccessOptions } from './guardian-middleware';
export { QuizEventAction, QuizEntityType, SystemEventType } from './events';
export type { QuizEventActionType, QuizEntityTypeValue, SystemEventTypeValue } from './events';
export type { FederatedSession } from '../types';
