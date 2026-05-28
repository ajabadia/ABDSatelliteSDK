import type { NextRequest, NextResponse } from 'next/server';

export interface NextFetchRequestConfig {
  revalidate?: number | false;
  tags?: string[];
}

export interface NextFetchRequestInit extends RequestInit {
  next?: NextFetchRequestConfig;
}

export interface TenantBrandingTheme {
  primary: string;
  secondary?: string;
  background?: string;
  rounded?: boolean;
  radius?: string;
}

export interface TenantBranding {
  logoUrl?: string | null;
  logo?: {
    url?: string | null;
    publicId?: string;
  } | null;
  favicon?: {
    url?: string | null;
    publicId?: string;
  } | null;
  theme?: TenantBrandingTheme | null;
}

export interface TenantInfo {
  active: boolean;
  tenantId: string;
  name: string;
  dbPrefix: string;
  isolationStrategy: string;
  allowedApps: string[];
  branding: TenantBranding | null;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  surname: string;
  role: string;
  tenantId: string;
  dbPrefix: string;
  isolationStrategy: string;
  permissions?: string[];
  allowedApps?: string[];
}

export interface FederatedSession {
  authenticated: boolean;
  user?: UserProfile;
}

export interface IndustrialAuthOptions {
  appId: string;
  clientId: string;
  clientSecret?: string;
  jwtSecret?: string;
  authProviderUrl?: string;
  baseAppUrl?: string;
  publicPaths?: string[];
  cookieName?: string;
  verifiedCookieName?: string;
  intlMiddleware?: (request: NextRequest) => Promise<NextResponse> | NextResponse;
}

// ──────────────────────────────────────────────
// 🎯 QUIZ Ecosystem Event Actions (ABDQuiz → ABDLogs)
// ──────────────────────────────────────────────

/**
 * Catálogo de acciones de auditoría del Ecosistema de Aprendizaje (ABDQuiz).
 * Cada constante representa un evento atómico trazable en ABDLogs.
 * 
 * Categorías:
 *   QUIZ_SPACE_LINK_*   → Vinculación de Spaces al ecosistema
 *   QUIZ_COURSE_*       → CRUD de cursos
 *   QUIZ_EXAM_CONFIG_*  → CRUD de plantillas de examen
 *   QUIZ_ASSIGNMENT_*   → Ciclo de vida de asignaciones
 *   QUIZ_ATTEMPT_*      → Ciclo de vida de intentos de examen
 *   QUIZ_ANSWER_*       → Respuestas individuales
 *   QUIZ_ROLE_*         → Asignación de roles contextuales
 */
export const QuizEventAction = {
  // ─── Configuración e Ingesta (Administradores/Creators) ───
  SPACE_LINK_CREATE: 'QUIZ_SPACE_LINK_CREATE',
  SPACE_LINK_UPDATE: 'QUIZ_SPACE_LINK_UPDATE',
  COURSE_CREATE: 'QUIZ_COURSE_CREATE',
  COURSE_UPDATE: 'QUIZ_COURSE_UPDATE',
  COURSE_DELETE: 'QUIZ_COURSE_DELETE',
  EXAM_CONFIG_CREATE: 'QUIZ_EXAM_CONFIG_CREATE',
  EXAM_CONFIG_UPDATE: 'QUIZ_EXAM_CONFIG_UPDATE',
  ASSIGNMENT_CREATE: 'QUIZ_ASSIGNMENT_CREATE',
  ASSIGNMENT_PUBLISH: 'QUIZ_ASSIGNMENT_PUBLISHED',

  // ─── Eventos del Alumno (Recipient) ───
  ATTEMPT_STARTED: 'QUIZ_ATTEMPT_STARTED',
  ANSWER_SUBMITTED: 'QUIZ_ANSWER_SUBMITTED',
  ATTEMPT_COMPLETED: 'QUIZ_ATTEMPT_COMPLETED',
  ATTEMPT_TIMEOUT: 'QUIZ_ATTEMPT_TIMEOUT',

  // ─── Eventos de Calificación y Auditoría (Creator/Auditor) ───
  ATTEMPT_MANUALLY_GRADED: 'QUIZ_ATTEMPT_MANUALLY_GRADED',
  ATTEMPT_INVALIDATED: 'QUIZ_ATTEMPT_INVALIDATED',

  // ─── Roles Contextuales ───
  ROLE_ASSIGNED: 'QUIZ_ROLE_ASSIGNED',
  ROLE_REVOKED: 'QUIZ_ROLE_REVOKED',
} as const;

/**
 * Tipo unión derivado del catálogo QuizEventAction.
 * Útil para tipar los valores `action` en los payloads de auditoría.
 */
export type QuizEventActionType = (typeof QuizEventAction)[keyof typeof QuizEventAction];

/**
 * Catálogo de tipos de entidad del Ecosistema de Aprendizaje.
 * Se usa en el campo `entityType` de los payloads de auditoría.
 */
export const QuizEntityType = {
  SPACE: 'SPACE',
  COURSE: 'COURSE',
  EXAM_CONFIG: 'EXAM_CONFIG',
  ASSIGNMENT: 'ASSIGNMENT',
  ATTEMPT: 'ATTEMPT',
  QUESTION: 'QUESTION',
  QUIZ_USER_ROLE: 'QUIZ_USER_ROLE',
} as const;

/**
 * Tipo unión derivado del catálogo QuizEntityType.
 * Útil para tipar el campo `entityType` en los payloads de auditoría.
 */
export type QuizEntityTypeValue = (typeof QuizEntityType)[keyof typeof QuizEntityType];

/**
 * 🔁 Result type for fetchWithRetry utility.
 */
export interface FetchRetryResult<T> {
  /** Whether the fetch succeeded (2xx status) */
  ok: boolean;
  /** Parsed JSON response data (only if ok is true) */
  data?: T;
  /** HTTP status code (if response was received) */
  status?: number;
  /** Error message string (if all retries failed) */
  error?: string;
}
