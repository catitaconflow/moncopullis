import type { Alerta } from '../data/tipos'

export type Mapa = Record<string, string>

export const TIPOS_ALERTA: Mapa = {
  STOCK_BAJO: 'Stock bajo',
  VENCIMIENTO_PROXIMO: 'Vencimiento próximo',
  STOCK_PENDIENTE: 'Stock pendiente',
  DOSIS_ATRASADA: 'Dosis atrasada',
  RECETA_PENDIENTE: 'Receta pendiente',
  DOSIS_APLICADA_TRAS_ANULAR: 'Dosis aplicada tras anular',
}

export const TIPOS_MOVIMIENTO: Mapa = {
  ENTRADA: 'Entrada',
  SALIDA_DOSIS: 'Dosis aplicada',
  REVERSA_DOSIS: 'Devolución por anulación',
  SALIDA_AJUSTE: 'Ajuste de salida',
  ENTRADA_AJUSTE: 'Ajuste de entrada',
}

export const MOTIVOS_AJUSTE: Mapa = {
  VENCIDO: 'Vencido',
  ROTO_DERRAME: 'Roto o derramado',
  CONTEO: 'Conteo físico',
  OTRO: 'Otro',
}

export const TIPOS_AJUSTE: Mapa = {
  SALIDA_AJUSTE: 'Salida (descontar)',
  ENTRADA_AJUSTE: 'Entrada (sumar)',
}

export const CATEGORIAS: Mapa = { VACA: 'Vaca', VAQUILLA: 'Vaquilla', TERNERO: 'Ternero', TORO: 'Toro' }
export const ESTADOS_PRODUCTIVOS: Mapa = { LACTANCIA: 'Lactancia', SECA: 'Seca' }
export const ORIGENES: Mapa = {
  NACIDO_EN_PREDIO: 'Nacido en el predio',
  COMPRA: 'Compra',
  PRESTAMO_RECIBIDO: 'Préstamo recibido',
}
export const MOTIVOS_BAJA: Mapa = {
  VENTA: 'Venta',
  MUERTE: 'Muerte',
  DEVOLUCION: 'Devolución al propietario',
  SACRIFICIO_SANITARIO: 'Sacrificio sanitario',
}
export const ESTADOS_DOSIS: Mapa = {
  PROGRAMADA: 'Programada',
  APLICADA: 'Aplicada',
  OMITIDA: 'Omitida',
  ANULADA: 'Anulada',
}
export const ROLES: Mapa = { ADMIN: 'Administrador', OPERARIO: 'Operario', AUDITOR: 'Auditor' }
export const UNIDADES: Mapa = { ML: 'ML', G: 'G', UNIDAD: 'UNIDAD' }

export function etiqueta(mapa: Mapa, clave: string | null | undefined): string {
  if (!clave) return '—'
  return mapa[clave] ?? clave
}

const SUMAN = new Set(['ENTRADA', 'REVERSA_DOSIS', 'ENTRADA_AJUSTE'])

/** Cantidad de un movimiento con signo: + si sube el stock, - si baja. */
export function cantidadConSigno(tipo: string, cantidad: number): number {
  return SUMAN.has(tipo) ? cantidad : -cantidad
}

/** A qué se refiere una alerta: medicamento, lote o animal de la dosis. */
export function referenciaAlerta(a: Alerta): string {
  if (a.medicamento) return a.medicamento.nombre_comercial
  if (a.lote) return `${a.lote.medicamento?.nombre_comercial ?? 'Medicamento'}, lote ${a.lote.numero_lote}`
  if (a.dosis) {
    const med = a.dosis.medicamento?.nombre_comercial ?? 'Dosis'
    const diio = a.dosis.tratamiento?.animal?.diio?.trim()
    return diio ? `${med}, animal ${diio}` : med
  }
  return '—'
}

const dos = (n: number): string => String(n).padStart(2, '0')

/** "No entregar leche hasta dd-mm hh:mm" si el resguardo sigue vigente; null si no aplica. */
export function textoResguardo(fin: string | null, ahora: Date = new Date()): string | null {
  if (!fin) return null
  const d = new Date(fin)
  if (Number.isNaN(d.getTime()) || d.getTime() <= ahora.getTime()) return null
  return `No entregar leche hasta ${dos(d.getDate())}-${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`
}
