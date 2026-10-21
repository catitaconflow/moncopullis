const fechaFmt = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fechaHoraFmt = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
const numeroFmt = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 })

/** Las fechas `date` (YYYY-MM-DD) se formatean sin pasar por zona horaria para no correr el día. */
export function formatoFecha(valor: string | null): string {
  if (!valor) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (m) return fechaFmt.format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? '—' : fechaFmt.format(d)
}

export function formatoFechaHora(valor: string | null): string {
  if (!valor) return '—'
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? '—' : fechaHoraFmt.format(d)
}

export function formatoNumero(n: number | null): string {
  return n === null || Number.isNaN(n) ? '—' : numeroFmt.format(n)
}
