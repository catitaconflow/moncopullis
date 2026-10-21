import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useVariantesFila } from './Animaciones'

export interface Columna<T> {
  titulo: string
  render: (fila: T) => ReactNode
  numerica?: boolean
}

interface TablaProps<T> {
  caption: string
  columnas: Columna<T>[]
  filas: T[]
  clave: (fila: T) => string | number
  /** Si se define, la primera columna se vuelve un botón que selecciona la fila. */
  onSeleccionar?: (fila: T) => void
  seleccionada?: string | number | null
}

/** Tabla en escritorio; en móvil cada fila se muestra como una tarjeta (ver index.css). */
export function Tabla<T>({ caption, columnas, filas, clave, onSeleccionar, seleccionada }: TablaProps<T>) {
  const variantes = useVariantesFila()
  return (
    <table className="tabla">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columnas.map((c) => (
            <th key={c.titulo} scope="col" className={c.numerica ? 'num' : undefined}>
              {c.titulo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, i) => {
          const id = clave(fila)
          const activa = seleccionada === id
          return (
            <motion.tr
              key={id}
              custom={i}
              variants={variantes}
              initial="oculto"
              animate="visible"
              className={activa ? 'fila-activa' : undefined}
            >
              {columnas.map((c, j) => (
                <td key={c.titulo} data-label={c.titulo} className={c.numerica ? 'num' : undefined}>
                  {j === 0 && onSeleccionar ? (
                    <button
                      type="button"
                      className="enlace-fila"
                      aria-pressed={activa}
                      onClick={() => onSeleccionar(fila)}
                    >
                      {c.render(fila)}
                    </button>
                  ) : (
                    c.render(fila)
                  )}
                </td>
              ))}
            </motion.tr>
          )
        })}
      </tbody>
    </table>
  )
}
