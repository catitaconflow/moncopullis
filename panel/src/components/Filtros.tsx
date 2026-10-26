export interface OpcionFiltro<K extends string> {
  clave: K
  texto: string
  cantidad: number
}

interface FiltrosProps<K extends string> {
  etiqueta: string
  opciones: OpcionFiltro<K>[]
  valor: K
  onCambiar: (clave: K) => void
}

/** Grupo de botones de filtro rápido; cada uno muestra cuántos registros coinciden. */
export function Filtros<K extends string>({ etiqueta, opciones, valor, onCambiar }: FiltrosProps<K>) {
  return (
    <div className="filtros" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.clave}
          type="button"
          className="filtro"
          aria-pressed={valor === o.clave}
          onClick={() => onCambiar(o.clave)}
        >
          {o.texto} <span className="filtro-cantidad">{o.cantidad}</span>
        </button>
      ))}
    </div>
  )
}

/** Barra de stock respecto del mínimo; el texto queda disponible para lectores de pantalla. */
export function BarraStock({ actual, minimo }: { actual: number; minimo: number }) {
  // La barra llena equivale al doble del mínimo, para que "justo en el mínimo" quede a la mitad.
  const tope = Math.max(minimo * 2, actual, 1)
  const pct = Math.min(100, Math.round((actual / tope) * 100))
  const bajo = actual < minimo
  return (
    <span className={`barra-stock${bajo ? ' barra-baja' : ''}`} aria-hidden="true">
      <span className="barra-relleno" style={{ width: `${pct}%` }} />
      <span className="barra-minimo" style={{ left: `${Math.round((minimo / tope) * 100)}%` }} />
    </span>
  )
}
