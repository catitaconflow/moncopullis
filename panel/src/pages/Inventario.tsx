import { useEffect, useRef, useState } from 'react'
import { Insignia, Vista } from '../components/Estado'
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

export function Inventario() {
  const q = useConsulta(listarMedicamentos, [])
  const [sel, setSel] = useState<Medicamento | null>(null)
  const detalle = useRef<HTMLElement>(null)

  useEffect(() => {
    if (sel) detalle.current?.focus()
  }, [sel])

  return (
    <>
      <h1>Inventario</h1>
      <Vista q={q} mensajeVacio="Aún no hay medicamentos registrados.">
        {(meds) => (
          <>
            <p className="muted">Selecciona un medicamento para ver sus lotes.</p>
            <Tabla
              caption="Medicamentos"
              columnas={colsMedicamento}
              filas={meds}
              clave={(m) => m.id}
              onSeleccionar={setSel}
              seleccionada={sel?.id}
            />
          </>
        )}
      </Vista>
      {sel && (
        <section ref={detalle} tabIndex={-1} className="detalle" aria-labelledby="titulo-lotes">
          <h2 id="titulo-lotes">Lotes de {sel.nombre_comercial}</h2>
          <Lotes med={sel} />
        </section>
      )}
    </>
  )
}
