import { useState, type FormEvent } from 'react'
import { useSesion } from '../auth/SesionProvider'
import { useAviso } from '../components/Avisos'
import { CampoSelect } from '../components/Campos'
import { leerTabla } from '../data/consultas'
import { ejecutar } from '../data/ejecutar'
import { descargar, generarArchivo, LIMITE_FILAS, nombreArchivo, sha256Hex, tablasPara, type Formato } from '../lib/exportar'
import { formatoNumero } from '../lib/formato'

interface Resultado {
  archivo: string
  filas: number
  sha256: string
  truncado: boolean
}

export function Exportar() {
  const { perfil } = useSesion()
  const tablas = tablasPara(perfil?.rol)
  const aviso = useAviso()
  const [tabla, setTabla] = useState('')
  const [formato, setFormato] = useState<Formato>('CSV')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)

  async function exportar(ev: FormEvent) {
    ev.preventDefault()
    const destino = tablas.find((x) => x.tabla === tabla)
    if (!destino) {
      setError('Elige la tabla que quieres exportar.')
      return
    }
    setError('')
    setResultado(null)
    setTrabajando(true)
    try {
      const filas = await leerTabla(destino.tabla, destino.columnas, LIMITE_FILAS)
      const contenido = generarArchivo(filas, formato)
      const sha256 = await sha256Hex(contenido)
      await ejecutar('fn_registrar_exportacion', { p_alcance: destino.tabla, p_formato: formato, p_filas: filas.length, p_sha256: sha256 })
      const archivo = nombreArchivo(destino.tabla, formato)
      descargar(contenido, archivo, formato)
      setResultado({ archivo, filas: filas.length, sha256, truncado: filas.length >= LIMITE_FILAS })
      aviso('Exportación lista.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo exportar.')
    }
    setTrabajando(false)
  }

  if (tablas.length === 0) {
    return (
      <>
        <h1>Exportar</h1>
        <p className="vacio">Tu rol no puede exportar datos.</p>
      </>
    )
  }

  return (
    <>
      <h1>Exportar</h1>
      <p className="muted">
        Descarga una tabla completa en CSV (para Excel) o JSON. Cada exportación queda registrada con la huella SHA-256 del archivo.
      </p>
      <form className="exportar-form" onSubmit={(ev) => void exportar(ev)} noValidate>
        <CampoSelect etiqueta="Tabla" value={tabla} onChange={(e) => setTabla(e.target.value)}>
          <option value="">Elige una tabla</option>
          {tablas.map((x) => (
            <option key={x.tabla} value={x.tabla}>{x.texto}</option>
          ))}
        </CampoSelect>
        <CampoSelect etiqueta="Formato" value={formato} onChange={(e) => setFormato(e.target.value as Formato)}>
          <option value="CSV">CSV (Excel)</option>
          <option value="JSON">JSON</option>
        </CampoSelect>
        <div className="form-acciones">
          <button type="submit" className="btn btn-primario" disabled={trabajando}>
            {trabajando ? 'Exportando…' : 'Exportar'}
          </button>
        </div>
      </form>
      {error && <p role="alert" className="form-error">{error}</p>}
      {resultado && (
        <section className="detalle" aria-labelledby="t-resultado">
          <h2 id="t-resultado">Archivo descargado</h2>
          <p>{resultado.archivo}: {formatoNumero(resultado.filas)} filas.</p>
          {resultado.truncado && (
            <p role="note" className="advertencia">
              Se alcanzó el límite de {formatoNumero(LIMITE_FILAS)} filas: puede haber más datos que no se incluyeron.
            </p>
          )}
          <p>Huella SHA-256:</p>
          <p className="huella">{resultado.sha256}</p>
        </section>
      )}
    </>
  )
}
