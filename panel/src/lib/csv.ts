export type Fila = Record<string, unknown>

/** Protege contra inyección de fórmulas en Excel: celdas de texto que empiezan con = + - @ (o tab/retorno). */
export function escaparCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  let s = typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
  if (typeof valor !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function columnasDe(filas: Fila[]): string[] {
  const vistas = new Set<string>()
  for (const f of filas) for (const k of Object.keys(f)) vistas.add(k)
  return [...vistas]
}

/** CSV para Excel: separador ';', saltos CRLF y BOM UTF-8 al inicio. */
export function generarCsv(filas: Fila[], columnas: string[] = columnasDe(filas)): string {
  const encabezado = columnas.map(escaparCelda).join(';')
  const cuerpo = filas.map((f) => columnas.map((c) => escaparCelda(f[c])).join(';'))
  return `\uFEFF${[encabezado, ...cuerpo].join('\r\n')}\r\n`
}
