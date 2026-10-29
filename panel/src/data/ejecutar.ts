import { getSupabase } from '../lib/supabase'

const MSG_CONEXION = 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.'
const MSG_PERMISO = 'No tienes permiso para esta acción.'

/** Traduce el error de una RPC a un mensaje para el usuario, sin detalles técnicos. */
export function mensajeDeError(error: { code?: string; message?: string }): string {
  if (error.code === 'P0001' && error.message) return error.message
  if (error.code === '42501') return MSG_PERMISO
  return MSG_CONEXION
}

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

export interface AltaUsuario {
  rut: string
  nombres: string
  apellidos: string
  email: string
  telefono: string | null
  rol: string
}

/** La contraseña temporal solo vive en la respuesta: no se guarda en ningún lado. */
export async function crearUsuario(alta: AltaUsuario): Promise<{ email: string; clave: string }> {
  let res
  try {
    res = await getSupabase().functions.invoke<{ email: string; clave: string }>('crear-usuario', { body: alta })
  } catch {
    throw new Error(MSG_CONEXION)
  }
  if (res.error) {
    // En respuestas 4xx la función manda el mensaje para el usuario en { error }
    const cuerpo: unknown = await (res.error as { context?: Response }).context?.json?.().catch(() => null)
    const msj = (cuerpo as { error?: unknown } | null)?.error
    throw new Error(typeof msj === 'string' ? msj : MSG_CONEXION)
  }
  if (!res.data?.clave) throw new Error(MSG_CONEXION)
  return res.data
}
