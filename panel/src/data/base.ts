import type { PostgrestError } from '@supabase/supabase-js'

export class ErrorDatos extends Error {}

/** Convierte un error de Supabase en un mensaje comprensible, sin detalles técnicos. */
export function comprobar<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error || res.data === null) {
    throw new ErrorDatos('No se pudieron cargar los datos. Revisa tu conexión e inténtalo de nuevo.')
  }
  return res.data
}

export function comprobarConteo(res: { count: number | null; error: PostgrestError | null }): number {
  if (res.error || res.count === null) {
    throw new ErrorDatos('No se pudo obtener la cifra. Inténtalo de nuevo.')
  }
  return res.count
}
