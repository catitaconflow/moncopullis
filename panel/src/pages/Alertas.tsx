import { useState } from 'react'
import { useAviso } from '../components/Avisos'
import { Insignia, Vista } from '../components/Estado'
import { Filtros } from '../components/Filtros'
import { Tabla, type Columna } from '../components/Tabla'
import { listarAlertas } from '../data/consultas'
import { ejecutar } from '../data/ejecutar'
import type { Alerta } from '../data/tipos'
import { useConsulta } from '../data/useConsulta'
import { FormMotivo } from '../formularios/FormMotivo'
import { etiqueta, referenciaAlerta, TIPOS_ALERTA } from '../lib/etiquetas'
import { formatoFechaHora } from '../lib/formato'

type Estado = 'ABIERTA' | 'RESUELTA'

interface Resultado {
  abiertas: number
  resueltas: number
}

function textoActualizacion(r: Resultado | null): string {
  if (!r) return 'Alertas actualizadas.'
  return `Alertas actualizadas: ${r.abiertas} nuevas y ${r.resueltas} cerradas.`
}

export function Alertas() {
  const [estado, setEstado] = useState<Estado>('ABIERTA')
  const q = useConsulta(() => listarAlertas(estado), [estado])
  const aviso = useAviso()
  const [resolviendo, setResolviendo] = useState<Alerta | null>(null)
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState('')

  async function actualizar() {
    setError('')
    setActualizando(true)
    try {
      aviso(textoActualizacion(await ejecutar<Resultado | null>('fn_actualizar_alertas')))
      q.recargar()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar.')
    }
    setActualizando(false)
  }

  const columnas: Columna<Alerta>[] = [
    { titulo: 'Tipo', render: (a) => <Insignia tono={a.estado === 'ABIERTA' ? 'alerta' : 'neutro'}>{etiqueta(TIPOS_ALERTA, a.tipo)}</Insignia> },
    { titulo: 'Se refiere a', render: referenciaAlerta },
    { titulo: 'Fecha', render: (a) => formatoFechaHora(a.fecha_creacion) },
    estado === 'ABIERTA'
      ? {
          titulo: 'Acciones',
          render: (a) => (
            <button type="button" className="btn btn-chico" onClick={() => setResolviendo(a)} aria-label={`Resolver alerta: ${etiqueta(TIPOS_ALERTA, a.tipo)}, ${referenciaAlerta(a)}`}>
              Resolver
            </button>
          ),
        }
      : { titulo: 'Resolución', render: (a) => `${formatoFechaHora(a.fecha_resolucion)}. ${a.comentario ?? ''}` },
  ]

  return (
    <>
      <div className="titulo-acciones">
        <h1>Alertas</h1>
        <button type="button" className="btn btn-primario" onClick={() => void actualizar()} disabled={actualizando}>
          {actualizando ? 'Actualizando…' : 'Actualizar alertas'}
        </button>
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="barra-herramientas">
        <Filtros
          etiqueta="Estado de las alertas"
          valor={estado}
          onCambiar={setEstado}
          opciones={[
            { clave: 'ABIERTA', texto: 'Abiertas' },
            { clave: 'RESUELTA', texto: 'Resueltas' },
          ]}
        />
      </div>
      <Vista q={q} mensajeVacio={estado === 'ABIERTA' ? 'No hay alertas abiertas.' : 'Aún no hay alertas resueltas.'}>
        {(filas) => <Tabla caption={estado === 'ABIERTA' ? 'Alertas abiertas' : 'Alertas resueltas'} columnas={columnas} filas={filas} clave={(a) => a.id} />}
      </Vista>
      {resolviendo && (
        <FormMotivo
          titulo="Resolver alerta"
          etiqueta="Comentario de la resolución"
          textoEnviar="Resolver"
          exito="Alerta resuelta."
          rpc="fn_resolver_alerta"
          parametroTexto="p_comentario"
          params={{ p_id: resolviendo.id }}
          onCerrar={() => setResolviendo(null)}
          alExito={q.recargar}
        />
      )}
    </>
  )
}
