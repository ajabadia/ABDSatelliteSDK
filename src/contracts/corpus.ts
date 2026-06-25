/**
 * @purpose Valida y refina la estructura de los datos de preguntas para su ingestión en un corpus.
 * @purpose_en Validates and refines the structure of question data for ingestion into a corpus.
 * @refactorable false
 * @classification Type Definition
 * @complexity Low
 * @fingerprint exports:3,imports:1,sig:18yizya
 * @lastUpdated 2026-06-25T09:20:40.832Z
 */

import { z } from 'zod';

export const IngestQuestionSchema = z.object({
  pregunta: z.string().min(10, "El enunciado es demasiado corto"),
  opciones: z.array(z.string()).min(2, "Se requieren al menos 2 opciones").max(6, "Máximo 6 opciones"),
  respuesta_correcta: z.preprocess((val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const match = val.trim().match(/^([A-F])/i);
      if (match) {
        const map: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5 };
        return map[match[1].toUpperCase()];
      }
    }
    return val;
  }, z.number().int().min(0, "Índice de respuesta inválido")),
  explicacion: z.string().optional().default(""),
  modulo: z.string().optional().default(""),
  fuente: z.string().optional().default(""),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  tags: z.array(z.string()).optional().default([]),
  spaceId: z.string().optional(),
  courseId: z.string().optional(),
  loadedAt: z.string().optional(),
  generatedAt: z.string().optional(),
  importVersion: z.string().optional(),
}).refine(data => data.respuesta_correcta < data.opciones.length, {
  message: "El índice de respuesta_correcta está fuera de rango",
  path: ["respuesta_correcta"]
});

export const CorpusImportSchema = z.array(IngestQuestionSchema);

export type IngestQuestion = z.infer<typeof IngestQuestionSchema>;
