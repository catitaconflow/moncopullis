import { forwardRef, useState } from 'react'
import { Insignia, Vista } from '../components/Estado'
import { Tabla, type Columna } from '../components/Tabla'
import { listarDosisDeTratamiento } from '../data/consultas'
import type { Dosis, Tratamiento } from '../data/tipos'
import { useConsulta } from '../data/useConsulta'
import { FormAplicar } from '../formularios/FormAplicar'
import { FormMotivo } from '../formularios/FormMotivo'
import { ESTADOS_DOSIS, etiqueta, textoResguardo } from '../lib/etiquetas'
import { formatoFechaHora, formatoNumero, textoDiio } from '../lib/formato'

const TONO: Record<string, 'ok' | 'alerta' | 'error' | 'neutro'> = {
  PROGRAMADA: 'alerta',
  APLICADA: 'ok',
  OMITIDA: 'neutro',
  ANULADA: 'error',
}

/** El resguardo vigente más lejano entre las dosis, o null si ninguno rige. */
export function resguardoVigente(dosis: Dosis[], ahora: Date = new Date()): string | null {
  const vigentes = dosis.filter((d) => textoResguardo(d.fin_resguardo_leche, ahora) !== null)
  if (vigentes.length === 0) return null
  const ultimo = vigentes.reduce((a, b) => (new Date(a.fin_resguardo_leche as string) > new Date(b.fin_resguardo_leche as string) ? a : b))
  return textoResguardo(ultimo.fin_resguardo_leche, ahora)
}

type Accion = { tipo: 'aplicar' | 'omitir'; dosis: Dosis } | { tipo: 'anular' } | null

interface Props {
  trat: Tratamiento
  esAdmin: boolean
  puedeOperar: boolean
  onCerrar: () => void
  recargarLista: () => void
}

export const DetalleTratamiento = forwardRef<HTMLElement, Props>(function DetalleTratamiento(
  { trat, esAdmin, puedeOperar, onCerrar, recargarLista },
  ref,
) {
  const q = useConsulta(() => listarDosisDeTratamiento(trat.id), [trat.id])
  const [accion, setAccion] = useState<Accion>(null)
  const anulado = trat.fecha_anulacion !== null
  const editable = puedeOperar && !anulado
  const alExito = () => {
    q.recargar()
    recargarLista()
  }
  const cerrar = () => setAccion(null)

  const columnas: Columna<Dosis>[] = [
    { titulo: 'Medicamento', render: (d) => d.medicamento?.nombre_comercial ?? '—' },
    { titulo: 'Cantidad', numerica: true, render: (d) => `${formatoNumero(d.cantidad)} ${d.medicamento?.unidad_base ?? ''}` },
    { titulo: 'Programada', render: (d) => formatoFechaHora(d.fecha_programada) },
    { titulo: 'Estado', render: (d) => <Insignia tono={TONO[d.estado] ?? 'neutro'}>{etiqueta(ESTADOS_DOSIS, d.estado)}</Insignia> },
    { titulo: 'Aplicación', render: (d) => (d.fecha_aplicada ? `${formatoFechaHora(d.fecha_aplicada)}, lote ${d.lote?.numero_lote ?? '—'}` : (d.motivo_estado ?? '—')) },
    { titulo: 'Resguardo de leche', render: (d) => textoResguardo(d.fin_resguardo_leche)?.replace('No entregar leche hasta ', 'Hasta ') ?? '—' },
  ]
  if (editable) {
    columnas.push({
      titulo: 'Acciones',
      render: (d) =>
        d.estado === 'PROGRAMADA' ? (
          <span className="acciones">
            <button type="button" className="btn btn-chico btn-primario" onClick={() => setAccion({ tipo: 'aplicar', dosis: d })}>Aplicar</button>
            <button type="button" className="btn btn-chico" onClick={() => setAccion({ tipo: 'omitir', dosis: d })}>Omitir</button>
          </span>
        ) : (
          '—'
        ),
    })
  }

  return (
    <section ref={ref} tabIndex={-1} className="detalle" aria-labelledby="titulo-detalle-trat">
      <div className="detalle-cabecera">
        <h2 id="titulo-detalle-trat">Tratamiento del animal {textoDiio(trat.animal?.diio)}</h2>
        <div className="acciones">
          {esAdmin && !anulado && (
            <button type="button" className="btn btn-chico btn-peligro" onClick={() => setAccion({ tipo: 'anular' })}>Anular tratamiento</button>
          )}
          <button type="button" className="btn btn-chico" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
      <p className="muted">
        {trat.motivo ?? 'Sin motivo'} · Indicado por {trat.indicado_por ?? '—'}
        {trat.numero_receta ? ` · Receta ${trat.numero_receta}` : ''} · {formatoFechaHora(trat.fecha_creacion)}
      </p>
      {anulado && (
        <p role="note" className="advertencia">
          Anulado el {formatoFechaHora(trat.fecha_anulacion)}: {trat.motivo_anulacion ?? 'sin motivo'}.
        </p>
      )}
      {q.datos && !anulado && resguardoVigente(q.datos) && (
        <p role="note" className="advertencia advertencia-fuerte">{resguardoVigente(q.datos)}.</p>
      )}
      <Vista q={q} mensajeVacio="Este tratamiento no tiene dosis." filasEsqueleto={3}>
        {(dosis) => <Tabla caption="Dosis del tratamiento" columnas={columnas} filas={dosis} clave={(d) => d.id} />}
      </Vista>

      {accion?.tipo === 'aplicar' && <FormAplicar dosis={accion.dosis} onCerrar={cerrar} alExito={alExito} />}
      {accion?.tipo === 'omitir' && (
        <FormMotivo
          titulo="Omitir dosis"
          etiqueta="Motivo para omitir la dosis"
          textoEnviar="Omitir dosis"
          exito="Dosis omitida."
          rpc="fn_omitir_dosis"
          parametroTexto="p_motivo"
          params={{ p_dosis_id: accion.dosis.id }}
          onCerrar={cerrar}
          alExito={alExito}
        />
      )}
      {accion?.tipo === 'anular' && (
        <FormMotivo
          titulo="Anular tratamiento"
          etiqueta="Motivo de la anulación"
          textoEnviar="Anular tratamiento"
          exito="Tratamiento anulado."
          peligro
          advertencia="Las dosis aplicadas se devuelven al stock de su lote y las pendientes quedan anuladas. No se puede deshacer."
          rpc="fn_anular_tratamiento"
          parametroTexto="p_motivo"
          params={{ p_id: trat.id }}
          onCerrar={cerrar}
          alExito={alExito}
        />
      )}
    </section>
  )
})
