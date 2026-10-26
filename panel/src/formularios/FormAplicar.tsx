import { useState } from 'react'
import { CampoSelect, CampoTexto } from '../components/Campos'
import { Dialogo } from '../components/Dialogo'
import { ErrorCarga, Esqueleto } from '../components/Estado'
import { FormularioDialogo } from '../components/FormularioDialogo'
import { listarLotes } from '../data/consultas'
import { ejecutar } from '../data/ejecutar'
import type { Dosis, Lote } from '../data/tipos'
import { useConsulta } from '../data/useConsulta'
import { aValorLocal, localAISO } from '../lib/dosis'
import { formatoFecha, formatoNumero } from '../lib/formato'
import { estadoVencimiento } from '../lib/vencimiento'
import type { PropsForm } from './base'

interface Props extends PropsForm {
  dosis: Dosis
}

/** Lotes del medicamento que se pueden usar: activos, no vencidos y con stock suficiente. */
export function lotesAplicables(lotes: Lote[], cantidad: number): Lote[] {
  return lotes.filter((l) => l.activo && estadoVencimiento(l.fecha_vencimiento) !== 'vencido' && l.stock_lote >= cantidad)
}

function CuerpoAplicar({ dosis, lotes, onCerrar, alExito }: Props & { lotes: Lote[] }) {
  const [loteId, setLoteId] = useState('')
  const [fecha, setFecha] = useState(aValorLocal(new Date()))
  const unidad = dosis.medicamento?.unidad_base ?? ''

  function validar(): string | null {
    if (!loteId) return 'Elige el lote.'
    const iso = localAISO(fecha)
    if (!iso) return 'Indica la fecha y hora de aplicación.'
    return new Date(iso).getTime() > Date.now() + 5 * 60_000 ? 'La fecha de aplicación no puede ser futura.' : null
  }

  return (
    <FormularioDialogo
      titulo={`Aplicar ${dosis.medicamento?.nombre_comercial ?? 'dosis'}`}
      textoEnviar="Aplicar dosis"
      exito="Dosis aplicada."
      validar={validar}
      enviar={() => ejecutar('fn_aplicar_dosis', { p_dosis_id: dosis.id, p_lote_id: Number(loteId), p_fecha_aplicada: localAISO(fecha) })}
      alExito={alExito}
      onCerrar={onCerrar}
    >
      <p>Cantidad de la dosis: <strong>{formatoNumero(dosis.cantidad)} {unidad}</strong></p>
      {lotes.length === 0 ? (
        <p role="note" className="advertencia">No hay lotes vigentes con stock suficiente para esta dosis. Registra una entrada o ajusta el stock.</p>
      ) : (
        <CampoSelect etiqueta="Lote" value={loteId} onChange={(e) => setLoteId(e.target.value)}>
          <option value="">Elige un lote</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.numero_lote}, stock {formatoNumero(l.stock_lote)} {unidad}, vence {formatoFecha(l.fecha_vencimiento)}
            </option>
          ))}
        </CampoSelect>
      )}
      <CampoTexto etiqueta="Fecha y hora de aplicación" type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
    </FormularioDialogo>
  )
}

export function FormAplicar(props: Props) {
  const q = useConsulta(() => listarLotes(props.dosis.medicamento_id), [props.dosis.medicamento_id])
  if (q.estado === 'error') {
    return (
      <Dialogo titulo="Aplicar dosis" onCerrar={props.onCerrar}>
        <ErrorCarga onReintentar={q.recargar} />
        <div className="form-acciones">
          <button type="button" className="btn" onClick={props.onCerrar}>Cerrar</button>
        </div>
      </Dialogo>
    )
  }
  if (!q.datos) {
    return (
      <Dialogo titulo="Aplicar dosis" onCerrar={props.onCerrar}>
        <Esqueleto filas={3} />
      </Dialogo>
    )
  }
  return <CuerpoAplicar {...props} lotes={lotesAplicables(q.datos, props.dosis.cantidad)} />
}
