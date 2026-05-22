import type { Query, Document } from 'mongoose';

export interface ContextIsolationOptions {
  allowedSpaceIds?: string[];
  allowedGroupIds?: string[];
}

/**
 * Aplica filtros de aislamiento a una consulta Mongoose para Row Level Security (RLS).
 * Garantiza que solo se extraen documentos asociados a los espacios o grupos permitidos.
 * 
 * @param query La consulta de Mongoose
 * @param options Opciones con los IDs permitidos
 * @returns La consulta modificada
 */
export function withContextIsolation<T extends Document, Q extends Query<any, T>>(
  query: Q,
  options: ContextIsolationOptions
): Q {
  const { allowedSpaceIds = [], allowedGroupIds = [] } = options;

  const orConditions: any[] = [];
  
  if (allowedSpaceIds.length > 0) {
    orConditions.push({ spaceId: { $in: allowedSpaceIds } });
  }
  
  if (allowedGroupIds.length > 0) {
    orConditions.push({ groupId: { $in: allowedGroupIds } });
  }
  
  if (orConditions.length > 0) {
    // Agregamos las condiciones OR a la query actual
    // Si ya existe un filtro principal, $and se puede necesitar, pero Mongoose maneja where encadenado a veces mezclándolo.
    // Usamos and() para asegurarnos de que no sobreescriba condiciones previas.
    query.and([{ $or: orConditions }]);
  } else {
    // Si no tiene permisos ni en espacios ni grupos, forzar que la query no retorne nada
    query.and([{ _id: null }]); // Filtro imposible
  }
  
  return query;
}
