/**
 * @purpose Proporciona constantes y tipos para eventos y entidades relacionados con quizzes utilizados en ABDSatelliteSDK.
 * @purpose_en Defines constants and types for quiz-related events and entities used in the ABDSatelliteSDK.
 * @refactorable false
 * @classification Data/Constants
 * @complexity Low
 * @fingerprint exports:6,imports:0,sig:1lmmgek
 * @lastUpdated 2026-06-26T10:03:38.358Z
 */

/**
 * Catálogo de acciones de auditoría del Ecosistema de Aprendizaje (ABDQuiz).
 * Cada constante representa un evento atómico trazable en ABDLogs.
 */
export const QuizEventAction = {
  SPACE_LINK_CREATE: 'QUIZ_SPACE_LINK_CREATE',
  SPACE_LINK_UPDATE: 'QUIZ_SPACE_LINK_UPDATE',
  COURSE_CREATE: 'QUIZ_COURSE_CREATE',
  COURSE_UPDATE: 'QUIZ_COURSE_UPDATE',
  COURSE_DELETE: 'QUIZ_COURSE_DELETE',
  EXAM_CONFIG_CREATE: 'QUIZ_EXAM_CONFIG_CREATE',
  EXAM_CONFIG_UPDATE: 'QUIZ_EXAM_CONFIG_UPDATE',
  ASSIGNMENT_CREATE: 'QUIZ_ASSIGNMENT_CREATE',
  ASSIGNMENT_PUBLISH: 'QUIZ_ASSIGNMENT_PUBLISHED',
  ATTEMPT_STARTED: 'QUIZ_ATTEMPT_STARTED',
  ANSWER_SUBMITTED: 'QUIZ_ANSWER_SUBMITTED',
  ATTEMPT_COMPLETED: 'QUIZ_ATTEMPT_COMPLETED',
  ATTEMPT_TIMEOUT: 'QUIZ_ATTEMPT_TIMEOUT',
  ATTEMPT_MANUALLY_GRADED: 'QUIZ_ATTEMPT_MANUALLY_GRADED',
  ATTEMPT_INVALIDATED: 'QUIZ_ATTEMPT_INVALIDATED',
  ROLE_ASSIGNED: 'QUIZ_ROLE_ASSIGNED',
  ROLE_REVOKED: 'QUIZ_ROLE_REVOKED',
} as const;

export type QuizEventActionType = (typeof QuizEventAction)[keyof typeof QuizEventAction];

export const QuizEntityType = {
  SPACE: 'SPACE',
  COURSE: 'COURSE',
  EXAM_CONFIG: 'EXAM_CONFIG',
  ASSIGNMENT: 'ASSIGNMENT',
  ATTEMPT: 'ATTEMPT',
  QUESTION: 'QUESTION',
  QUIZ_USER_ROLE: 'QUIZ_USER_ROLE',
} as const;

export type QuizEntityTypeValue = (typeof QuizEntityType)[keyof typeof QuizEntityType];

export const SystemEventType = {
  FILE_UPLOADED: 'files.uploaded',
  FILE_DELETED: 'files.deleted',
  FILE_VERSION_CREATED: 'files.version.created',
  STORAGE_CONNECTOR_CHANGED: 'storage.connector.changed',
  TENANT_CONFIG_CHANGED: 'tenant.config.changed',
  TENANT_CREATED: 'tenant.created',
  USER_ROLE_CHANGED: 'user.role.changed',
  GUARDIAN_POLICY_CHANGED: 'guardian.policy.changed',
  LICENSE_REQUESTED: 'license.requested',
  LICENSE_RESOLVED: 'license.resolved',
  QUIZ_ATTEMPT_STARTED: 'quiz.attempt.started',
  QUIZ_ATTEMPT_COMPLETED: 'quiz.attempt.completed',
} as const;

export type SystemEventTypeValue = (typeof SystemEventType)[keyof typeof SystemEventType];
