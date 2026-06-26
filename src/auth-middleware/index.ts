/**
 * @purpose Proporciona funciones y tipos de autenticación relacionadas con el manejo del acceso industrial, la gestión de sesiones y las acciones de eventos.
 * @purpose_en Exports authentication-related functions and types for handling industrial access, session management, and event actions.
 * @refactorable false
 * @classification Business Service
 * @complexity Low
 * @fingerprint exports:3,imports:0,sig:e3hhhe
 * @lastUpdated 2026-06-26T10:03:43.751Z
 */

export { withIndustrialAuth } from './proxy';
export { createAuthRouteHandler } from './routeHandler';
export { getIndustrialSession, ensureIndustrialAccess, UnauthorizedAccessError, InsufficientPrivilegesError } from './session';
export { getCache, setCache, delCache, sessionCacheKey, verifyCacheKey, hashToken } from './session/redis-store';
export { withGuardianAccess } from './guardian-middleware';
export { evaluateAccess } from '../utils/guardian';
export type { GuardianAccessOptions } from './guardian-middleware';
export { QuizEventAction, QuizEntityType, SystemEventType } from './events';
export type { QuizEventActionType, QuizEntityTypeValue, SystemEventTypeValue } from './events';
export type { FederatedSession } from '../types';
