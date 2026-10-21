import { useEffect, useMemo, useRef, useState } from 'react'
import { Vista } from '../components/Estado'
import { Tabla, type Columna } from '../components/Tabla'
import { TablaTratamientos } from '../components/TablaTratamientos'
import { listarAnimales, listarTratamientosDeAnimal } from '../data/consultas'
import type { Animal } from '../data/tipos'
import { useConsulta } from '../data/useConsulta'
import { formatoFecha } from '../lib/formato'

const MAX_VISIBLES = 200

const columnas: Columna<Animal>[] = [
  { titulo: 'DIIO', render: (a) => a.diio.trim() },
  { titulo: 'Categoría', render: (a) => a.categoria ?? '—' },
  { titulo: 'Estado productivo', render: (a) => a.estado_productivo ?? '—' },
  { titulo: 'Fecha de baja', render: (a) => formatoFecha(a.fecha_baja) },
]

function normalizar(s: string): string {
  return s.trim().toLowerCase()
}

export function filtrarAnimales(animales: Animal[], texto: string): Animal[] {
  const t = normalizar(texto)
  if (!t) return animales
  return animales.filter((a) => normalizar(a.diio).includes(t) || normalizar(a.categoria ?? '').includes(t))
}

function TratamientosDe({ animal }: { animal: Animal }) {
  const q = useConsulta(() => listarTratamientosDeAnimal(animal.id), [animal.id])
  return (
    <Vista q={q} mensajeVacio="Este animal no tiene tratamientos registrados." filasEsqueleto={2}>
      {(t) => <TablaTratamientos filas={t} conAnimal={false} />}
    </Vista>
  )
}

export function Animales() {
  const q = useConsulta(listarAnimales, [])
  const [texto, setTexto] = useState('')
  const [sel, setSel] = useState<Animal | null>(null)
  const detalle = useRef<HTMLElement>(null)

  useEffect(() => {
    if (sel) detalle.current?.focus()
  }, [sel])

  const filtrados = useMemo(() => (q.datos ? filtrarAnimales(q.datos, texto) : []), [q.datos, texto])

  return (
    <>
      <h1>Animales</h1>
      <Vista q={q} mensajeVacio="Aún no hay animales registrados.">
        {() => (
          <>
            <div className="buscador">
              <label htmlFor="buscar">Buscar por DIIO o categoría</label>
              <input
                id="buscar"
                type="search"
                autoComplete="off"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </div>
            <p className="muted" aria-live="polite">
              {filtrados.length} {filtrados.length === 1 ? 'animal' : 'animales'}
              {filtrados.length > MAX_VISIBLES && ` (se muestran los primeros ${MAX_VISIBLES}; afina la búsqueda)`}
            </p>
            {filtrados.length === 0 ? (
              <p className="vacio">Ningún animal coincide con la búsqueda.</p>
            ) : (
              <Tabla
                caption="Animales"
                columnas={columnas}
                filas={filtrados.slice(0, MAX_VISIBLES)}
                clave={(a) => a.id}
                onSeleccionar={setSel}
                seleccionada={sel?.id}
              />
            )}
          </>
        )}
      </Vista>
      {sel && (
        <section ref={detalle} tabIndex={-1} className="detalle" aria-labelledby="titulo-trat">
          <h2 id="titulo-trat">Tratamientos del animal {sel.diio.trim()}</h2>
          <TratamientosDe animal={sel} />
        </section>
      )}
    </>
  )
}
