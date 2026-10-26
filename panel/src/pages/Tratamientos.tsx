import { useMemo, useState } from 'react'
import { Vista } from '../components/Estado'
import { Filtros } from '../components/Filtros'
import { TablaTratamientos } from '../components/TablaTratamientos'
import { listarTratamientos } from '../data/consultas'
import type { Tratamiento } from '../data/tipos'
import { useConsulta } from '../data/useConsulta'

type FiltroTrat = 'todos' | 'vigentes' | 'anulados'

export function filtrarTratamientos(filas: Tratamiento[], filtro: FiltroTrat, texto: string): Tratamiento[] {
  const t = texto.trim().toLowerCase()
  return filas.filter(
    (x) =>
      (filtro === 'todos' || (filtro === 'anulados') === (x.fecha_anulacion !== null)) &&
      (!t || (x.animal?.diio ?? '').toLowerCase().includes(t) || (x.motivo ?? '').toLowerCase().includes(t)),
  )
}

export function Tratamientos() {
  const q = useConsulta(listarTratamientos, [])
  const [filtro, setFiltro] = useState<FiltroTrat>('todos')
  const [texto, setTexto] = useState('')
  const filtrados = useMemo(() => filtrarTratamientos(q.datos ?? [], filtro, texto), [q.datos, filtro, texto])
  const total = q.datos?.length ?? 0
  const anulados = q.datos?.filter((x) => x.fecha_anulacion !== null).length ?? 0

  return (
    <>
      <h1>Tratamientos</h1>
      <Vista q={q} mensajeVacio="Aún no hay tratamientos registrados.">
        {() => (
          <>
            <div className="barra-herramientas">
              <Filtros
                etiqueta="Filtrar por estado"
                valor={filtro}
                onCambiar={setFiltro}
                opciones={[
                  { clave: 'todos', texto: 'Todos', cantidad: total },
                  { clave: 'vigentes', texto: 'Vigentes', cantidad: total - anulados },
                  { clave: 'anulados', texto: 'Anulados', cantidad: anulados },
                ]}
              />
              <div className="buscador">
                <label htmlFor="buscar-trat">Buscar por DIIO o motivo</label>
                <input
                  id="buscar-trat"
                  type="search"
                  autoComplete="off"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
              </div>
            </div>
            <p className="muted" aria-live="polite">
              {filtrados.length} de los últimos {total} tratamientos, del más reciente al más antiguo.
            </p>
            {filtrados.length === 0 ? (
              <p className="vacio">Ningún tratamiento coincide con el filtro.</p>
            ) : (
              <TablaTratamientos filas={filtrados} conAnimal />
            )}
          </>
        )}
      </Vista>
    </>
  )
}
