import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSesion } from '../auth/SesionProvider'
import { Insignia, Vista } from '../components/Estado'
import { BarraStock, Filtros } from '../components/Filtros'
import { Tabla, type Columna } from '../components/Tabla'
import { listarMedicamentos, listarTodosMedicamentos } from '../data/consultas'
import type { Medicamento } from '../data/tipos'
import { useConsulta } from '../data/useConsulta'
import { FormMedicamento } from '../formularios/FormMedicamento'
import { formatoNumero } from '../lib/formato'
import { esAdmin as rolAdmin, puedeOperar as rolOpera } from '../lib/permisos'
import { estadoStock } from '../lib/vencimiento'
import { DetalleMedicamento } from './DetalleMedicamento'

function EstadoMedicamento({ m }: { m: Medicamento }) {
  if (!m.activo) return <Insignia tono="neutro">Inactivo</Insignia>
  return estadoStock(m.stock_actual, m.stock_minimo) === 'bajo' ? (
    <Insignia tono="error">Bajo mínimo</Insignia>
  ) : (
    <Insignia tono="ok">OK</Insignia>
  )
}

const colsMedicamento: Columna<Medicamento>[] = [
  { titulo: 'Medicamento', render: (m) => m.nombre_comercial },
  { titulo: 'Stock actual', numerica: true, render: (m) => formatoNumero(m.stock_actual) },
  { titulo: 'Stock mínimo', numerica: true, render: (m) => formatoNumero(m.stock_minimo) },
  { titulo: 'Nivel', render: (m) => <BarraStock actual={m.stock_actual} minimo={m.stock_minimo} /> },
  { titulo: 'Unidad', render: (m) => m.unidad_base },
  { titulo: 'Estado', render: (m) => <EstadoMedicamento m={m} /> },
]

type FiltroStock = 'todos' | 'bajo' | 'ok' | 'inactivos'

function leerFiltro(valor: string | null): FiltroStock {
  return valor === 'bajo' || valor === 'ok' || valor === 'inactivos' ? valor : 'todos'
}

function cumple(m: Medicamento, filtro: FiltroStock): boolean {
  if (filtro === 'todos') return true
  if (filtro === 'inactivos') return !m.activo
  return m.activo && estadoStock(m.stock_actual, m.stock_minimo) === filtro
}

export function filtrarMedicamentos(meds: Medicamento[], filtro: FiltroStock, texto: string): Medicamento[] {
  const t = texto.trim().toLowerCase()
  return meds.filter(
    (m) =>
      cumple(m, filtro) &&
      (!t || m.nombre_comercial.toLowerCase().includes(t) || (m.principio_activo ?? '').toLowerCase().includes(t)),
  )
}

export function Inventario() {
  const { perfil } = useSesion()
  const admin = rolAdmin(perfil?.rol)
  const opera = rolOpera(perfil?.rol)
  const q = useConsulta(admin ? listarTodosMedicamentos : listarMedicamentos, [admin])
  const [params, setParams] = useSearchParams()
  const filtro = leerFiltro(params.get('filtro'))
  const [texto, setTexto] = useState('')
  const [selId, setSelId] = useState<number | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const meds = q.datos ?? []
  const sel = meds.find((m) => m.id === selId) ?? null
  const activos = meds.filter((m) => m.activo)
  const nBajo = activos.filter((m) => estadoStock(m.stock_actual, m.stock_minimo) === 'bajo').length
  const filtrados = useMemo(() => filtrarMedicamentos(q.datos ?? [], filtro, texto), [q.datos, filtro, texto])
  const detalle = useRef<HTMLElement>(null)

  useEffect(() => {
    if (selId !== null) detalle.current?.focus()
  }, [selId])

  const opciones = [
    { clave: 'todos' as const, texto: 'Todos', cantidad: meds.length },
    { clave: 'bajo' as const, texto: 'Bajo mínimo', cantidad: nBajo },
    { clave: 'ok' as const, texto: 'OK', cantidad: activos.length - nBajo },
    ...(admin ? [{ clave: 'inactivos' as const, texto: 'Inactivos', cantidad: meds.length - activos.length }] : []),
  ]

  return (
    <>
      <div className="titulo-acciones">
        <h1>Inventario</h1>
        {admin && (
          <button type="button" className="btn btn-primario" onClick={() => setNuevo(true)}>
            Nuevo medicamento
          </button>
        )}
      </div>
      <Vista q={q} mensajeVacio="Aún no hay medicamentos registrados.">
        {() => (
          <>
            <div className="barra-herramientas">
              <Filtros
                etiqueta="Filtrar por stock"
                valor={filtro}
                onCambiar={(f) => setParams(f === 'todos' ? {} : { filtro: f }, { replace: true })}
                opciones={opciones}
              />
              <div className="buscador">
                <label htmlFor="buscar-med">Buscar medicamento</label>
                <input
                  id="buscar-med"
                  type="search"
                  autoComplete="off"
                  placeholder="Nombre o principio activo"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
              </div>
            </div>
            <p className="muted" aria-live="polite">
              {filtrados.length} {filtrados.length === 1 ? 'medicamento' : 'medicamentos'}. Pulsa uno para ver sus lotes y movimientos.
            </p>
            {filtrados.length === 0 ? (
              <p className="vacio">Ningún medicamento coincide con el filtro.</p>
            ) : (
              <Tabla
                caption="Medicamentos"
                columnas={colsMedicamento}
                filas={filtrados}
                clave={(m) => m.id}
                onSeleccionar={(m) => setSelId(m.id)}
                seleccionada={selId}
              />
            )}
          </>
        )}
      </Vista>
      {sel && (
        <DetalleMedicamento
          ref={detalle}
          med={sel}
          esAdmin={admin}
          puedeOperar={opera}
          onCerrar={() => setSelId(null)}
          recargarLista={q.recargar}
        />
      )}
      {nuevo && <FormMedicamento med={null} onCerrar={() => setNuevo(false)} alExito={q.recargar} />}
    </>
  )
}
