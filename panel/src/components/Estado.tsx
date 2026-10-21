import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import type { Consulta } from '../data/useConsulta'

export function Esqueleto({ filas = 4 }: { filas?: number }) {
  const quieto = useReducedMotion()
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="esqueleto">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: filas }, (_, i) => (
        <motion.div
          key={i}
          className="esqueleto-fila"
          aria-hidden="true"
          animate={quieto ? undefined : { opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 }}
        />
      ))}
    </div>
  )
}

export function Vacio({ mensaje }: { mensaje: string }) {
  return <p className="vacio">{mensaje}</p>
}

export function ErrorCarga({ onReintentar, mensaje }: { onReintentar: () => void; mensaje?: string }) {
  return (
    <div role="alert" className="error-caja">
      <p>{mensaje ?? 'No se pudieron cargar los datos. Revisa tu conexión e inténtalo de nuevo.'}</p>
      <button type="button" className="btn" onClick={onReintentar}>
        Reintentar
      </button>
    </div>
  )
}

interface VistaProps<T> {
  q: Consulta<T>
  mensajeVacio: string
  esVacio?: (datos: T) => boolean
  filasEsqueleto?: number
  children: (datos: T) => ReactNode
}

/** Resuelve los cuatro estados de una consulta: carga, error, vacío y éxito. */
export function Vista<T>({ q, mensajeVacio, esVacio, filasEsqueleto, children }: VistaProps<T>) {
  if (q.estado === 'cargando') return <Esqueleto filas={filasEsqueleto} />
  if (q.estado === 'error' || q.datos === null) return <ErrorCarga onReintentar={q.recargar} />
  const vacio = esVacio ? esVacio(q.datos) : Array.isArray(q.datos) && q.datos.length === 0
  return vacio ? <Vacio mensaje={mensajeVacio} /> : <>{children(q.datos)}</>
}

type Tono = 'ok' | 'alerta' | 'error' | 'neutro'

export function Insignia({ tono, children }: { tono: Tono; children: ReactNode }) {
  return <span className={`insignia insignia-${tono}`}>{children}</span>
}
