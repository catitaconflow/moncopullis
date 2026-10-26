const MS_HORA = 3_600_000
export const MAX_DOSIS = 60

/** Fechas de `veces` dosis: la primera en `inicio` y las siguientes cada `cadaHoras`. Vacío si los datos no sirven. */
export function generarRepeticiones(inicio: Date, cadaHoras: number, veces: number): Date[] {
  if (Number.isNaN(inicio.getTime())) return []
  if (!(cadaHoras > 0) || !Number.isInteger(veces) || veces < 1 || veces > MAX_DOSIS) return []
  return Array.from({ length: veces }, (_, i) => new Date(inicio.getTime() + i * cadaHoras * MS_HORA))
}

const dos = (n: number): string => String(n).padStart(2, '0')

/** Valor para <input type="datetime-local"> en hora local: yyyy-MM-ddTHH:mm. */
export function aValorLocal(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`
}

/** Convierte el valor de un datetime-local (hora local) a ISO con zona; null si no es válido. */
export function localAISO(valor: string): string | null {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
