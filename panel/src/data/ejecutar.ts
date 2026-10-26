import { getSupabase } from '../lib/supabase'

const MSG_CONEXION = 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.'
const MSG_PERMISO = 'No tienes permiso para esta acción.'

/** Traduce el error de una RPC a un mensaje para el usuario, sin detalles técnicos. */
export function mensajeDeError(error: { code?: string; message?: string }): string {
  if (error.code === 'P0001' && error.message) return error.message
  if (error.code === '42501') return MSG_PERMISO
  return MSG_CONEXION
}

/** Llama a una función RPC de escritura. Lanza Error con un mensaje comprensible si falla. */
export async function ejecutar<T = unknown>(nombre: string, params: Record<string, unknown> = {}): Promise<T> {
  let res
  try {
    res = await getSupabase().rpc(nombre, params)
  } catch {
    throw new Error(MSG_CONEXION)
  }
  if (res.error) throw new Error(mensajeDeError(res.error))
  return res.data as T
}
