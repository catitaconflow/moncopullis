import { getSupabase } from '../lib/supabase'
import { DIAS_ALERTA, estadoStock, fechaISOMasDias } from '../lib/vencimiento'
import { comprobar, comprobarConteo } from './base'
import type {
  Animal, Lote, Medicamento, PerfilUsuario, RegistroAuditoria, Tratamiento,
} from './tipos'

export const FILAS_POR_PAGINA = 50

const COLS_TRAT = 'id, animal_id, motivo, fecha_creacion, fecha_anulacion, animal:animal_id(diio)'

export async function obtenerPerfil(authUserId: string): Promise<PerfilUsuario | null> {
  const res = await getSupabase()
    .from('usuario').select('nombres, apellidos, rol').eq('auth_user_id', authUserId).maybeSingle()
  if (res.error) throw new Error('No se pudo leer el perfil.')
  return res.data as PerfilUsuario | null
}

export async function listarMedicamentos(): Promise<Medicamento[]> {
  const res = await getSupabase()
    .from('medicamento')
    .select('id, nombre_comercial, principio_activo, unidad_base, stock_actual, stock_minimo, activo')
    .eq('activo', true)
    .order('nombre_comercial')
  return comprobar(res) as Medicamento[]
}

export async function listarLotes(medicamentoId: number): Promise<Lote[]> {
  const res = await getSupabase()
    .from('lote')
    .select('id, medicamento_id, numero_lote, fecha_vencimiento, stock_lote, activo')
    .eq('medicamento_id', medicamentoId)
    .order('fecha_vencimiento')
  return comprobar(res) as Lote[]
}

export async function listarAnimales(): Promise<Animal[]> {
  const res = await getSupabase()
    .from('animal')
    .select('id, diio, categoria, estado_productivo, fecha_baja')
    .order('diio')
    .limit(5000)
  return comprobar(res) as Animal[]
}

export async function listarTratamientosDeAnimal(animalId: number): Promise<Tratamiento[]> {
  const res = await getSupabase()
    .from('tratamiento').select(COLS_TRAT).eq('animal_id', animalId)
    .order('fecha_creacion', { ascending: false })
  return comprobar(res) as unknown as Tratamiento[]
}

export async function listarTratamientos(): Promise<Tratamiento[]> {
  const res = await getSupabase()
    .from('tratamiento').select(COLS_TRAT)
    .order('fecha_creacion', { ascending: false })
    .limit(500)
  return comprobar(res) as unknown as Tratamiento[]
}

export async function listarAuditoria(pagina: number): Promise<RegistroAuditoria[]> {
  const desde = pagina * FILAS_POR_PAGINA
  // Se piden 51 filas para saber si existe una página siguiente.
  const res = await getSupabase()
    .from('auditoria')
    .select('id, fecha, accion, entidad, origen, usuario:usuario_id(nombres, apellidos)')
    .order('fecha', { ascending: false })
    .range(desde, desde + FILAS_POR_PAGINA)
  return comprobar(res) as unknown as RegistroAuditoria[]
}

// Cifras del resumen: cada una es una consulta independiente.

export async function contarMedicamentosBajoMinimo(): Promise<number> {
  // PostgREST no compara columna con columna: se filtra en cliente con la misma regla que Inventario.
  const meds = await listarMedicamentos()
  return meds.filter((m) => estadoStock(m.stock_actual, m.stock_minimo) === 'bajo').length
}

export async function contarLotesPorVencer(): Promise<number> {
  const res = await getSupabase()
    .from('lote').select('id', { count: 'exact', head: true })
    .eq('activo', true)
    .gt('stock_lote', 0)
    .lte('fecha_vencimiento', fechaISOMasDias(DIAS_ALERTA))
  return comprobarConteo(res)
}

export async function contarAnimalesActivos(): Promise<number> {
  const res = await getSupabase()
    .from('animal').select('id', { count: 'exact', head: true }).is('fecha_baja', null)
  return comprobarConteo(res)
}

/** Tratamiento abierto: no anulado y con al menos una dosis PROGRAMADA. */
export async function contarTratamientosAbiertos(): Promise<number> {
  const res = await getSupabase()
    .from('tratamiento').select('id, dosis!inner(id)', { count: 'exact', head: true })
    .is('fecha_anulacion', null)
    .eq('dosis.estado', 'PROGRAMADA')
  return comprobarConteo(res)
}
