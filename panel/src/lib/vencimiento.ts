export const DIAS_ALERTA = 60

export type EstadoVencimiento = 'vencido' | 'proximo' | 'vigente' | 'sin_fecha'
export type EstadoStock = 'ok' | 'bajo'

const MS_DIA = 86_400_000

function aUTC(fechaISO: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaISO)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Días enteros desde `hoy` hasta la fecha (negativo = ya vencido). null si la fecha no es válida. */
export function diasParaVencer(fechaISO: string | null, hoy: Date = new Date()): number | null {
  if (!fechaISO) return null
  const f = aUTC(fechaISO)
  if (f === null) return null
  const h = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((f - h) / MS_DIA)
}

export function estadoVencimiento(
  fechaISO: string | null,
  hoy: Date = new Date(),
  umbral: number = DIAS_ALERTA,
): EstadoVencimiento {
  const d = diasParaVencer(fechaISO, hoy)
  if (d === null) return 'sin_fecha'
  if (d < 0) return 'vencido'
  return d <= umbral ? 'proximo' : 'vigente'
}

export function estadoStock(actual: number, minimo: number): EstadoStock {
  return actual < minimo ? 'bajo' : 'ok'
}

/** Fecha ISO (YYYY-MM-DD) de hoy + n días, en hora local. */
export function fechaISOMasDias(n: number, hoy: Date = new Date()): string {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + n)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
