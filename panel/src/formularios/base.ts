export interface PropsForm {
  onCerrar: () => void
  /** Se llama tras guardar: recarga las consultas afectadas. */
  alExito: () => void
}

/** Fecha local de hoy como yyyy-MM-dd (para <input type="date">). */
export function hoyISO(): string {
  const d = new Date()
  const dos = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

/** Texto vacío -> null, para los campos opcionales de las RPC. */
export function opcional(valor: string): string | null {
  return valor.trim() === '' ? null : valor.trim()
}
