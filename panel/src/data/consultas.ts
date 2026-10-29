import { getSupabase } from '../lib/supabase'
import { DIAS_ALERTA, estadoStock, fechaISOMasDias } from '../lib/vencimiento'
import { comprobar, comprobarConteo } from './base'
import type {
  Alerta, Animal, Dosis, Lote, Medicamento, Movimiento, PerfilUsuario, Propietario, Proveedor,
  RegistroAuditoria, Tratamiento, Usuario,
} from './tipos'

export const FILAS_POR_PAGINA = 50

const COLS_TRAT =
  'id, animal_id, motivo, indicado_por, numero_receta, observaciones, fecha_creacion, fecha_anulacion, motivo_anulacion, animal:animal_id(diio)'
const COLS_MED =
  'id, nombre_comercial, principio_activo, tipo, via_administracion, unidad_base, contenido_envase, requiere_receta, resguardo_leche_dias, stock_actual, stock_minimo, activo'
const COLS_ANIMAL =
  'id, diio, categoria, estado_productivo, fecha_baja, motivo_baja, propietario_id, fecha_nacimiento, madre_id, origen_ingreso, observaciones'

export async function obtenerPerfil(authUserId: string): Promise<PerfilUsuario | null> {
  const res = await getSupabase()
    .from('usuario').select('nombres, apellidos, rol').eq('auth_user_id', authUserId).maybeSingle()
  if (res.error) throw new Error('No se pudo leer el perfil.')
  return res.data as PerfilUsuario | null
}

/** Solo medicamentos activos (resumen y selectores). */
export async function listarMedicamentos(): Promise<Medicamento[]> {
  const res = await getSupabase()
    .from('medicamento').select(COLS_MED).eq('activo', true).order('nombre_comercial')
  return comprobar(res) as Medicamento[]
}

/** Activos e inactivos (pantalla de inventario para ADMIN). */
export async function listarTodosMedicamentos(): Promise<Medicamento[]> {
  const res = await getSupabase().from('medicamento').select(COLS_MED).order('nombre_comercial')
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
    .select(COLS_ANIMAL)
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

export async function listarTratamientos(limite = 500): Promise<Tratamiento[]> {
  const res = await getSupabase()
    .from('tratamiento').select(COLS_TRAT)
    .order('fecha_creacion', { ascending: false })
    .limit(limite)
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

export interface LotePorVencer extends Lote {
  medicamento: { nombre_comercial: string } | null
}

/** Lotes con stock que vencen dentro del umbral de alerta (incluye vencidos), del más urgente al menos. */
export async function listarLotesPorVencer(limite: number): Promise<LotePorVencer[]> {
  const res = await getSupabase()
    .from('lote')
    .select('id, medicamento_id, numero_lote, fecha_vencimiento, stock_lote, activo, medicamento:medicamento_id(nombre_comercial)')
    .eq('activo', true)
    .gt('stock_lote', 0)
    .lte('fecha_vencimiento', fechaISOMasDias(DIAS_ALERTA))
    .order('fecha_vencimiento')
    .limit(limite)
  return comprobar(res) as unknown as LotePorVencer[]
}


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

const LIMITE_MOVIMIENTOS = 50

/** Últimos movimientos de un medicamento, con número de lote y usuario (si el rol puede leerlo). */
export async function listarMovimientos(medicamentoId: number): Promise<Movimiento[]> {
  const sb = getSupabase()
  const res = await sb
    .from('movimiento_inventario')
    .select('id, lote_id, tipo, cantidad, motivo, observaciones, fecha_evento, usuario:usuario_id(nombres, apellidos)')
    .eq('medicamento_id', medicamentoId)
    .order('fecha_evento', { ascending: false })
    .limit(LIMITE_MOVIMIENTOS)
  const movs = comprobar(res) as unknown as Omit<Movimiento, 'lote'>[]
  const lotes = await listarLotes(medicamentoId)
  const numeros = new Map(lotes.map((l) => [l.id, l.numero_lote]))
  return movs.map((m) => ({ ...m, lote: numeros.has(m.lote_id) ? { numero_lote: numeros.get(m.lote_id) as string } : null }))
}

/** Dosis de un tratamiento con medicamento y lote (el lote se une aparte: la clave foránea es compuesta). */
export async function listarDosisDeTratamiento(tratamientoId: number): Promise<Dosis[]> {
  const res = await getSupabase()
    .from('dosis')
    .select('id, tratamiento_id, medicamento_id, lote_id, cantidad, estado, fecha_programada, fecha_aplicada, fin_resguardo_leche, motivo_estado, medicamento:medicamento_id(nombre_comercial, unidad_base)')
    .eq('tratamiento_id', tratamientoId)
    .order('fecha_programada')
  const dosis = comprobar(res) as unknown as Omit<Dosis, 'lote'>[]
  const ids = [...new Set(dosis.map((d) => d.lote_id).filter((x): x is number => x !== null))]
  const numeros = new Map<number, string>()
  if (ids.length > 0) {
    const r = await getSupabase().from('lote').select('id, numero_lote').in('id', ids)
    for (const l of comprobar(r) as { id: number; numero_lote: string }[]) numeros.set(l.id, l.numero_lote)
  }
  return dosis.map((d) => ({ ...d, lote: d.lote_id !== null && numeros.has(d.lote_id) ? { numero_lote: numeros.get(d.lote_id) as string } : null }))
}

export async function listarAlertas(estado: 'ABIERTA' | 'RESUELTA'): Promise<Alerta[]> {
  const res = await getSupabase()
    .from('alerta')
    .select(
      'id, tipo, estado, fecha_creacion, fecha_resolucion, comentario, medicamento:medicamento_id(nombre_comercial), lote:lote_id(numero_lote, medicamento:medicamento_id(nombre_comercial)), dosis:dosis_id(medicamento:medicamento_id(nombre_comercial), tratamiento:tratamiento_id(animal:animal_id(diio)))',
    )
    .eq('estado', estado)
    .order('fecha_creacion', { ascending: false })
    .limit(500)
  return comprobar(res) as unknown as Alerta[]
}

export async function contarAlertasAbiertas(): Promise<number> {
  const res = await getSupabase()
    .from('alerta').select('id', { count: 'exact', head: true }).eq('estado', 'ABIERTA')
  return comprobarConteo(res)
}

export async function listarPropietarios(): Promise<Propietario[]> {
  const res = await getSupabase()
    .from('propietario').select('id, rut, nombre_completo, telefono, activo').order('nombre_completo')
  return comprobar(res) as Propietario[]
}

/** Solo ADMIN puede leerlos (RLS). */
export async function listarProveedores(): Promise<Proveedor[]> {
  const res = await getSupabase()
    .from('proveedor').select('id, rut, razon_social, nombre_contacto, telefono, email, activo').order('razon_social')
  return comprobar(res) as Proveedor[]
}

/** Solo ADMIN ve a todos (RLS). De Telegram solo se pide si está vinculado. */
export async function listarUsuarios(): Promise<Usuario[]> {
  const res = await getSupabase()
    .from('usuario').select('id, nombres, apellidos, email, rol, activo, telegram_user_id').order('apellidos')
  return comprobar(res) as Usuario[]
}

export interface Importacion { id: number; export_id: string; cantidad_registros: number; fecha: string }

export async function listarImportaciones(): Promise<Importacion[]> {
  const res = await getSupabase()
    .from('importacion').select('id, export_id, cantidad_registros, fecha').order('fecha', { ascending: false }).limit(20)
  return comprobar(res) as Importacion[]
}

const TAMANO_PAGINA = 1000

/**
 * Lee hasta `limite` filas de una tabla, de a páginas (la API recorta cada respuesta a su máximo).
 * Para usuario se piden columnas explícitas y se omiten los secretos de vinculación con Telegram.
 */
export async function leerTabla(tabla: string, columnas: string, limite: number): Promise<Record<string, unknown>[]> {
  const filas: Record<string, unknown>[] = []
  while (filas.length < limite) {
    const desde = filas.length
    const hasta = Math.min(desde + TAMANO_PAGINA, limite) - 1
    const res = await getSupabase().from(tabla).select(columnas).order('id').range(desde, hasta)
    const pagina = comprobar(res) as unknown as Record<string, unknown>[]
    filas.push(...pagina)
    if (pagina.length < hasta - desde + 1) break
  }
  return filas
}
