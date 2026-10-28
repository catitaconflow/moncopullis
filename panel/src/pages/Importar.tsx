import { useState, type ChangeEvent } from 'react'
import { useAviso } from '../components/Avisos'
import { CampoTexto } from '../components/Campos'
import { Vista } from '../components/Estado'
import { Tabla, type Columna } from '../components/Tabla'
import { listarImportaciones, type Importacion } from '../data/consultas'
import { ejecutar } from '../data/ejecutar'
import { useConsulta } from '../data/useConsulta'
import { formatoFechaHora, formatoNumero } from '../lib/formato'
import { revisarArchivo, type Revision } from '../lib/importacion'

const MAX_ERRORES_VISIBLES = 20

const columnas: Columna<Importacion>[] = [
  { titulo: 'Fecha', render: (i) => formatoFechaHora(i.fecha) },
  { titulo: 'Identificador', render: (i) => i.export_id },
  { titulo: 'Registros', render: (i) => formatoNumero(i.cantidad_registros) },
]

export function Importar() {
  const historial = useConsulta(listarImportaciones, [])
  const aviso = useAviso()
  const [nombre, setNombre] = useState('')
  const [revision, setRevision] = useState<Revision | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')

  async function elegir(ev: ChangeEvent<HTMLInputElement>) {
    const archivo = ev.target.files?.[0]
    setError('')
    setRevision(null)
    if (!archivo) return
    if (archivo.size > 10 * 1024 * 1024) {
      setError('El archivo pesa más de 10 MB. Divídelo en partes.')
      return
    }
    setNombre(archivo.name)
    setRevision(revisarArchivo(await archivo.text()))
  }

  async function importar() {
    if (!revision || revision.errores.length) return
    setTrabajando(true)
    setError('')
    try {
      const r = await ejecutar<{ estado: string; cantidad?: number }>('fn_importar_exportacion', {
        p_export_id: revision.exportId, p_registros: revision.registros,
      })
      aviso(r.estado === 'ya_importado'
        ? 'Ese archivo ya se había importado: no se duplicó nada.'
        : `Importación lista: ${formatoNumero(r.cantidad ?? 0)} registros.`)
      setRevision(null)
      setNombre('')
      historial.recargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo importar.')
    }
    setTrabajando(false)
  }

  const valido = revision !== null && revision.errores.length === 0

  return (
    <>
      <h1>Importar</h1>
      <p className="muted">
        Carga un archivo JSON con export_id y registros. Se revisa completo antes de importar y entra todo o nada.
        Si el mismo archivo se importa dos veces, no se duplica.
      </p>

      <div className="exportar-form">
        <CampoTexto etiqueta="Archivo JSON" type="file" accept="application/json,.json" onChange={(e) => void elegir(e)}
          ayuda="Entidades permitidas: animal, medicamento, lote, tratamiento y dosis. Hasta 5.000 registros." />
      </div>

      {revision && (
        <section className="detalle" aria-labelledby="t-revision">
          <h2 id="t-revision">Revisión de {nombre}</h2>
          {valido ? (
            <>
              <p>
                Identificador: <strong>{revision.exportId}</strong>. {formatoNumero(revision.registros.length)} registros:{' '}
                {Object.entries(revision.porEntidad).map(([e, n]) => `${n} ${e}`).join(', ')}.
              </p>
              <div className="form-acciones">
                <button type="button" className="btn btn-primario" disabled={trabajando} onClick={() => void importar()}>
                  {trabajando ? 'Importando…' : 'Importar'}
                </button>
              </div>
            </>
          ) : (
            <div role="alert" className="form-error">
              <p>El archivo tiene {revision.errores.length} problema(s). Corrígelo y vuelve a cargarlo; no se importó nada.</p>
              <ul>
                {revision.errores.slice(0, MAX_ERRORES_VISIBLES).map((e) => <li key={e}>{e}</li>)}
              </ul>
              {revision.errores.length > MAX_ERRORES_VISIBLES && <p>Y {revision.errores.length - MAX_ERRORES_VISIBLES} más.</p>}
            </div>
          )}
        </section>
      )}
      {error && <p role="alert" className="form-error">{error}</p>}

      <section aria-labelledby="t-historial">
        <h2 id="t-historial">Últimas importaciones</h2>
        <Vista q={historial} mensajeVacio="Aún no hay importaciones.">
          {(filas) => <Tabla caption="Últimas importaciones" columnas={columnas} filas={filas} clave={(i) => i.id} />}
        </Vista>
      </section>
    </>
  )
}
