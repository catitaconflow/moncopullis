import { useEffect, useMemo, useRef, useState } from 'react'
import { Insignia, Vista } from '../components/Estado'
import { Filtros } from '../components/Filtros'
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
  {
    titulo: 'Situación',
    render: (a) =>
      a.fecha_baja ? <Insignia tono="neutro">Baja {formatoFecha(a.fecha_baja)}</Insignia> : <Insignia tono="ok">Activo</Insignia>,
  },
]

function normalizar(s: string): string {
  return s.trim().toLowerCase()
}

type FiltroAnimal = 'activos' | 'baja' | 'todos'

function cumpleFiltro(a: Animal, filtro: FiltroAnimal): boolean {
  if (filtro === 'todos') return true
  return filtro === 'activos' ? a.fecha_baja === null : a.fecha_baja !== null
}

export function filtrarAnimales(animales: Animal[], texto: string, filtro: FiltroAnimal = 'todos'): Animal[] {
  const t = normalizar(texto)
  return animales.filter(
    (a) =>
      cumpleFiltro(a, filtro) &&
      (!t || normalizar(a.diio).includes(t) || normalizar(a.categoria ?? '').includes(t)),
  )
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
  const [filtro, setFiltro] = useState<FiltroAnimal>('activos')
  const [sel, setSel] = useState<Animal | null>(null)
  const detalle = useRef<HTMLElement>(null)

  useEffect(() => {
    if (sel) detalle.current?.focus()
  }, [sel])

  const filtrados = useMemo(
    () => (q.datos ? filtrarAnimales(q.datos, texto, filtro) : []),
    [q.datos, texto, filtro],
  )
  const total = q.datos?.length ?? 0
  const activos = q.datos?.filter((a) => a.fecha_baja === null).length ?? 0

  return (
    <>
      <h1>Animales</h1>
      <Vista q={q} mensajeVacio="Aún no hay animales registrados.">
        {() => (
          <>
            <div className="barra-herramientas">
              <Filtros
                etiqueta="Filtrar por situación"
                valor={filtro}
                onCambiar={setFiltro}
                opciones={[
                  { clave: 'activos', texto: 'Activos', cantidad: activos },
                  { clave: 'baja', texto: 'De baja', cantidad: total - activos },
                  { clave: 'todos', texto: 'Todos', cantidad: total },
                ]}
              />
              <div className="buscador">
                <label htmlFor="buscar">Buscar por DIIO o categoría</label>
                <input
                  id="buscar"
                  type="search"
                  autoComplete="off"
                  placeholder="Ej.: 0123 o vaca"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
              </div>
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
          <div className="detalle-cabecera">
            <h2 id="titulo-trat">Tratamientos del animal {sel.diio.trim()}</h2>
            <button type="button" className="btn btn-chico" onClick={() => setSel(null)}>
              Cerrar
            </button>
          </div>
          <TratamientosDe animal={sel} />
        </section>
      )}
    </>
  )
}
