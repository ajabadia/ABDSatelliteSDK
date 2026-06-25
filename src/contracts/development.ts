/**
 * @purpose Valida y define esquemas para texto de desarrollo e ingresos de adjuntos.
 * @purpose_en Validates and defines schemas for development text and attachment inputs.
 * @refactorable false
 * @classification Type Definition
 * @complexity Low
 * @fingerprint exports:4,imports:1,sig:cvlmw8
 * @lastUpdated 2026-06-25T09:20:48.001Z
 */

import { z } from 'zod';

const MAX_RESPONSE_LENGTH = 10000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const DevelopmentTextSchema = z.object({
  responseText: z
    .string()
    .max(MAX_RESPONSE_LENGTH, `La respuesta no puede superar los ${MAX_RESPONSE_LENGTH} caracteres`)
    .optional()
    .default(''),
});

export const DevelopmentAttachmentSchema = z.object({
  size: z
    .number()
    .max(MAX_FILE_SIZE, 'El archivo no puede superar los 5 MB'),
  mimeType: z
    .enum(['application/pdf', 'image/jpeg', 'image/png']),
  name: z.string().min(1, 'El nombre del archivo es requerido'),
});

export type DevelopmentTextInput = z.infer<typeof DevelopmentTextSchema>;
export type DevelopmentAttachmentInput = z.infer<typeof DevelopmentAttachmentSchema>;
