import { useEffect, useMemo, useRef, useState } from 'react'
import { Insignia, Vista } from '../components/Estado'
import { Filtros } from '../components/Filtros'
import { Tabla, type Columna } from '../components/Tabla'
import { TablaTratamientos } from '../components/TablaTratamientos'
import { useSesion } from '../auth/SesionProvider'
import { listarAnimales, listarTratamientosDeAnimal } from '../data/consultas'
import type { Animal } from '../data/tipos'
import { useConsulta } from '../data/useConsulta'
import { FormAnimal, FormBaja } from '../formularios/FormAnimal'
import { FormTratamiento } from '../formularios/FormTratamiento'
import { CATEGORIAS, ESTADOS_PRODUCTIVOS, etiqueta, MOTIVOS_BAJA } from '../lib/etiquetas'
import { formatoFecha, textoDiio } from '../lib/formato'
import { puedeOperar } from '../lib/permisos'

const MAX_VISIBLES = 200

const columnas: Columna<Animal>[] = [
  { titulo: 'DIIO', render: (a) => textoDiio(a.diio) },
  { titulo: 'Categoría', render: (a) => etiqueta(CATEGORIAS, a.categoria) },
  { titulo: 'Estado productivo', render: (a) => etiqueta(ESTADOS_PRODUCTIVOS, a.estado_productivo) },
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
      (!t || normalizar(a.diio ?? '').includes(t) || normalizar(a.categoria ?? '').includes(t)),
  )
}

function TratamientosDe({ animal, version }: { animal: Animal; version: number }) {
  const q = useConsulta(() => listarTratamientosDeAnimal(animal.id), [animal.id, version])
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
  const { perfil } = useSesion()
  const opera = puedeOperar(perfil?.rol)
  const [selId, setSelId] = useState<number | null>(null)
  const [dlg, setDlg] = useState<'nuevo' | 'editar' | 'baja' | 'tratamiento' | null>(null)
  const [version, setVersion] = useState(0)
  const sel = q.datos?.find((a) => a.id === selId) ?? null
  const detalle = useRef<HTMLElement>(null)

  useEffect(() => {
    if (selId !== null) detalle.current?.focus()
  }, [selId])

  const filtrados = useMemo(
    () => (q.datos ? filtrarAnimales(q.datos, texto, filtro) : []),
    [q.datos, texto, filtro],
  )
  const total = q.datos?.length ?? 0
  const activos = q.datos?.filter((a) => a.fecha_baja === null).length ?? 0

  return (
    <>
      <div className="titulo-acciones">
        <h1>Animales</h1>
        {opera && (
          <button type="button" className="btn btn-primario" onClick={() => setDlg('nuevo')}>
            Nuevo animal
          </button>
        )}
      </div>
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
                onSeleccionar={(a) => setSelId(a.id)}
                seleccionada={selId}
              />
            )}
          </>
        )}
      </Vista>
      {sel && (
        <section ref={detalle} tabIndex={-1} className="detalle" aria-labelledby="titulo-trat">
          <div className="detalle-cabecera">
            <h2 id="titulo-trat">Animal {textoDiio(sel.diio)}</h2>
            <div className="acciones">
              {opera && !sel.fecha_baja && (
                <>
                  <button type="button" className="btn btn-chico btn-primario" onClick={() => setDlg('tratamiento')}>Nuevo tratamiento</button>
                  <button type="button" className="btn btn-chico" onClick={() => setDlg('editar')}>Editar</button>
                  <button type="button" className="btn btn-chico btn-peligro" onClick={() => setDlg('baja')}>Dar de baja</button>
                </>
              )}
              <button type="button" className="btn btn-chico" onClick={() => setSelId(null)}>Cerrar</button>
            </div>
          </div>
          {sel.fecha_baja && (
            <p className="muted">Baja el {formatoFecha(sel.fecha_baja)}: {etiqueta(MOTIVOS_BAJA, sel.motivo_baja)}.</p>
          )}
          <h3>Tratamientos</h3>
          <TratamientosDe animal={sel} version={version} />
        </section>
      )}
      {dlg === 'nuevo' && <FormAnimal animal={null} onCerrar={() => setDlg(null)} alExito={q.recargar} />}
      {dlg === 'editar' && sel && <FormAnimal animal={sel} onCerrar={() => setDlg(null)} alExito={q.recargar} />}
      {dlg === 'baja' && sel && <FormBaja animal={sel} onCerrar={() => setDlg(null)} alExito={q.recargar} />}
      {dlg === 'tratamiento' && sel && (
        <FormTratamiento animalInicial={sel} onCerrar={() => setDlg(null)} alExito={() => setVersion((v) => v + 1)} />
      )}
    </>
  )
}
