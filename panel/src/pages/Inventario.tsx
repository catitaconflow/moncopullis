import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Insignia, Vista } from '../components/Estado'
import { BarraStock, Filtros } from '../components/Filtros'
import { Tabla, type Columna } from '../components/Tabla'
import { listarLotes, listarMedicamentos } from '../data/consultas'
import type { Lote, Medicamento } from '../data/tipos'
import { useConsulta } from '../data/useConsulta'
import { formatoFecha, formatoNumero } from '../lib/formato'
import { diasParaVencer, estadoStock, estadoVencimiento } from '../lib/vencimiento'

const colsMedicamento: Columna<Medicamento>[] = [
  { titulo: 'Medicamento', render: (m) => m.nombre_comercial },
  { titulo: 'Stock actual', numerica: true, render: (m) => formatoNumero(m.stock_actual) },
  { titulo: 'Stock mínimo', numerica: true, render: (m) => formatoNumero(m.stock_minimo) },
  { titulo: 'Nivel', render: (m) => <BarraStock actual={m.stock_actual} minimo={m.stock_minimo} /> },
  { titulo: 'Unidad', render: (m) => m.unidad_base },
  {
    titulo: 'Estado',
    render: (m) =>
      estadoStock(m.stock_actual, m.stock_minimo) === 'bajo' ? (
        <Insignia tono="error">Bajo mínimo</Insignia>
      ) : (
        <Insignia tono="ok">OK</Insignia>
      ),
  },
]

function EstadoLote({ l }: { l: Lote }) {
  const est = estadoVencimiento(l.fecha_vencimiento)
  const dias = diasParaVencer(l.fecha_vencimiento)
  if (est === 'vencido') return <Insignia tono="error">Vencido</Insignia>
  if (est === 'proximo') return <Insignia tono="alerta">Vence en {dias} {dias === 1 ? 'día' : 'días'}</Insignia>
  return <Insignia tono="ok">Vigente</Insignia>
}

const colsLote: Columna<Lote>[] = [
  { titulo: 'Lote', render: (l) => (l.activo ? l.numero_lote : `${l.numero_lote} (inactivo)`) },
  { titulo: 'Vencimiento', render: (l) => formatoFecha(l.fecha_vencimiento) },
  { titulo: 'Stock del lote', numerica: true, render: (l) => formatoNumero(l.stock_lote) },
  { titulo: 'Estado', render: (l) => <EstadoLote l={l} /> },
]

function Lotes({ med }: { med: Medicamento }) {
  const q = useConsulta(() => listarLotes(med.id), [med.id])
  return (
    <Vista q={q} mensajeVacio="Este medicamento no tiene lotes registrados." filasEsqueleto={3}>
      {(lotes) => <Tabla caption={`Lotes de ${med.nombre_comercial}`} columnas={colsLote} filas={lotes} clave={(l) => l.id} />}
    </Vista>
  )
}

type FiltroStock = 'todos' | 'bajo' | 'ok'

export function filtrarMedicamentos(meds: Medicamento[], filtro: FiltroStock, texto: string): Medicamento[] {
  const t = texto.trim().toLowerCase()
  return meds.filter(
    (m) =>
      (filtro === 'todos' || estadoStock(m.stock_actual, m.stock_minimo) === filtro) &&
      (!t || m.nombre_comercial.toLowerCase().includes(t) || (m.principio_activo ?? '').toLowerCase().includes(t)),
  )
}

export function Inventario() {
  const q = useConsulta(listarMedicamentos, [])
  const [params, setParams] = useSearchParams()
  const filtro: FiltroStock = params.get('filtro') === 'bajo' ? 'bajo' : params.get('filtro') === 'ok' ? 'ok' : 'todos'
  const [texto, setTexto] = useState('')
  const [sel, setSel] = useState<Medicamento | null>(null)
  const meds = q.datos ?? []
  const nBajo = meds.filter((m) => estadoStock(m.stock_actual, m.stock_minimo) === 'bajo').length
  const filtrados = useMemo(() => filtrarMedicamentos(q.datos ?? [], filtro, texto), [q.datos, filtro, texto])
  const detalle = useRef<HTMLElement>(null)

  useEffect(() => {
    if (sel) detalle.current?.focus()
  }, [sel])

  return (
    <>
      <h1>Inventario</h1>
      <Vista q={q} mensajeVacio="Aún no hay medicamentos registrados.">
        {() => (
          <>
            <div className="barra-herramientas">
              <Filtros
                etiqueta="Filtrar por stock"
                valor={filtro}
                onCambiar={(f) => setParams(f === 'todos' ? {} : { filtro: f }, { replace: true })}
                opciones={[
                  { clave: 'todos', texto: 'Todos', cantidad: meds.length },
                  { clave: 'bajo', texto: 'Bajo mínimo', cantidad: nBajo },
                  { clave: 'ok', texto: 'OK', cantidad: meds.length - nBajo },
                ]}
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
              {filtrados.length} {filtrados.length === 1 ? 'medicamento' : 'medicamentos'}. Pulsa uno para ver sus lotes.
            </p>
            {filtrados.length === 0 ? (
              <p className="vacio">Ningún medicamento coincide con el filtro.</p>
            ) : (
              <Tabla
                caption="Medicamentos"
                columnas={colsMedicamento}
                filas={filtrados}
                clave={(m) => m.id}
                onSeleccionar={setSel}
                seleccionada={sel?.id}
              />
            )}
          </>
        )}
      </Vista>
      {sel && (
        <section ref={detalle} tabIndex={-1} className="detalle" aria-labelledby="titulo-lotes">
          <div className="detalle-cabecera">
            <h2 id="titulo-lotes">Lotes de {sel.nombre_comercial}</h2>
            <button type="button" className="btn btn-chico" onClick={() => setSel(null)}>
              Cerrar
            </button>
          </div>
          <Lotes med={sel} />
        </section>
      )}
    </>
  )
}
