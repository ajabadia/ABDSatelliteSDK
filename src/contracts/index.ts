/**
 * @purpose Proporciona esquemas y tipos para datos corporativos y de desarrollo.
 * @purpose_en Exports schemas and types for corpus and development data.
 * @refactorable false
 * @classification Type Definition
 * @complexity Low
 * @fingerprint exports:2,imports:0,sig:fxpzw4
 * @lastUpdated 2026-06-25T09:20:54.962Z
 */

export { IngestQuestionSchema, CorpusImportSchema } from './corpus';
export type { IngestQuestion } from './corpus';

export { DevelopmentTextSchema, DevelopmentAttachmentSchema } from './development';
export type { DevelopmentTextInput, DevelopmentAttachmentInput } from './development';
