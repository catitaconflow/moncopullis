import { forwardRef, useState } from 'react'
import { Insignia, Vista } from '../components/Estado'
import { Tabla, type Columna } from '../components/Tabla'
import { listarLotes, listarMovimientos } from '../data/consultas'
import type { Lote, Medicamento, Movimiento } from '../data/tipos'
import { useConsulta } from '../data/useConsulta'
import { FormAjuste } from '../formularios/FormAjuste'
import { FormEntrada } from '../formularios/FormEntrada'
import { FormMedicamento } from '../formularios/FormMedicamento'
import { cantidadConSigno, etiqueta, MOTIVOS_AJUSTE, TIPOS_MOVIMIENTO } from '../lib/etiquetas'
import { formatoFecha, formatoFechaHora, formatoNumero } from '../lib/formato'
import { diasParaVencer, estadoVencimiento } from '../lib/vencimiento'

function EstadoLote({ l }: { l: Lote }) {
  const est = estadoVencimiento(l.fecha_vencimiento)
  const dias = diasParaVencer(l.fecha_vencimiento)
  if (est === 'vencido') return <Insignia tono="error">Vencido</Insignia>
  if (est === 'proximo') return <Insignia tono="alerta">Vence en {dias} {dias === 1 ? 'día' : 'días'}</Insignia>
  return <Insignia tono="ok">Vigente</Insignia>
}

function columnasLote(onAjustar: ((l: Lote) => void) | null): Columna<Lote>[] {
  const base: Columna<Lote>[] = [
    { titulo: 'Lote', render: (l) => (l.activo ? l.numero_lote : `${l.numero_lote} (inactivo)`) },
    { titulo: 'Vencimiento', render: (l) => formatoFecha(l.fecha_vencimiento) },
    { titulo: 'Stock del lote', numerica: true, render: (l) => formatoNumero(l.stock_lote) },
    { titulo: 'Estado', render: (l) => <EstadoLote l={l} /> },
  ]
  if (!onAjustar) return base
  return [
    ...base,
    {
      titulo: 'Acciones',
      render: (l) => (
        <button type="button" className="btn btn-chico" onClick={() => onAjustar(l)} aria-label={`Ajustar lote ${l.numero_lote}`}>
          Ajustar
        </button>
      ),
    },
  ]
}

function textoCantidad(m: Movimiento): string {
  const n = cantidadConSigno(m.tipo, m.cantidad)
  return `${n > 0 ? '+' : '−'}${formatoNumero(Math.abs(n))}`
}

const colsMovimiento: Columna<Movimiento>[] = [
  { titulo: 'Fecha', render: (m) => formatoFechaHora(m.fecha_evento) },
  { titulo: 'Lote', render: (m) => m.lote?.numero_lote ?? '—' },
  { titulo: 'Tipo', render: (m) => etiqueta(TIPOS_MOVIMIENTO, m.tipo) },
  { titulo: 'Cantidad', numerica: true, render: textoCantidad },
  { titulo: 'Motivo', render: (m) => (m.motivo ? etiqueta(MOTIVOS_AJUSTE, m.motivo) : (m.observaciones ?? '—')) },
  { titulo: 'Usuario', render: (m) => (m.usuario ? `${m.usuario.nombres} ${m.usuario.apellidos}` : '—') },
]

type Dialogo = { tipo: 'editar' } | { tipo: 'entrada' } | { tipo: 'ajuste'; lote: Lote } | null

interface Props {
  med: Medicamento
  esAdmin: boolean
  puedeOperar: boolean
  onCerrar: () => void
  /** Recarga la lista de medicamentos (el stock cambió). */
  recargarLista: () => void
}

export const DetalleMedicamento = forwardRef<HTMLElement, Props>(function DetalleMedicamento(
  { med, esAdmin, puedeOperar, onCerrar, recargarLista },
  ref,
) {
  const lotes = useConsulta(() => listarLotes(med.id), [med.id])
  const movs = useConsulta(() => listarMovimientos(med.id), [med.id])
  const [dlg, setDlg] = useState<Dialogo>(null)

  const alExito = () => {
    recargarLista()
    lotes.recargar()
    movs.recargar()
  }
  const cerrar = () => setDlg(null)

  return (
    <section ref={ref} tabIndex={-1} className="detalle" aria-labelledby="titulo-lotes">
      <div className="detalle-cabecera">
        <h2 id="titulo-lotes">{med.nombre_comercial}{med.activo ? '' : ' (inactivo)'}</h2>
        <div className="acciones">
          {esAdmin && <button type="button" className="btn btn-chico" onClick={() => setDlg({ tipo: 'editar' })}>Editar</button>}
          {puedeOperar && med.activo && (
            <button type="button" className="btn btn-chico btn-primario" onClick={() => setDlg({ tipo: 'entrada' })} disabled={lotes.estado !== 'ok'}>
              Registrar entrada
            </button>
          )}
          <button type="button" className="btn btn-chico" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>

      <h3>Lotes</h3>
      <Vista q={lotes} mensajeVacio="Este medicamento no tiene lotes registrados." filasEsqueleto={3}>
        {(ls) => (
          <Tabla
            caption={`Lotes de ${med.nombre_comercial}`}
            columnas={columnasLote(puedeOperar ? (l) => setDlg({ tipo: 'ajuste', lote: l }) : null)}
            filas={ls}
            clave={(l) => l.id}
          />
        )}
      </Vista>

      <h3>Historial de movimientos</h3>
      <p className="muted">Últimos 50 movimientos.</p>
      <Vista q={movs} mensajeVacio="Este medicamento aún no tiene movimientos." filasEsqueleto={3}>
        {(ms) => <Tabla caption={`Movimientos de ${med.nombre_comercial}`} columnas={colsMovimiento} filas={ms} clave={(m) => m.id} />}
      </Vista>

      {dlg?.tipo === 'editar' && <FormMedicamento med={med} onCerrar={cerrar} alExito={alExito} />}
      {dlg?.tipo === 'entrada' && lotes.datos && (
        <FormEntrada med={med} lotes={lotes.datos} conProveedor={esAdmin} onCerrar={cerrar} alExito={alExito} />
      )}
      {dlg?.tipo === 'ajuste' && <FormAjuste med={med} lote={dlg.lote} onCerrar={cerrar} alExito={alExito} />}
    </section>
  )
})
