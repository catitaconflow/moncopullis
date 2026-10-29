import { useState, type FormEvent, type ReactNode } from 'react'
import { Dialogo } from './Dialogo'
import { useAviso } from './Avisos'

interface FormularioDialogoProps {
  titulo: string
  textoEnviar?: string
  exito: string
  /** Botón principal en rojo (anular, dar de baja). */
  peligro?: boolean
  validar?: () => string | null
  /** Llama a la RPC; debe lanzar Error con un mensaje comprensible si falla. */
  enviar: () => Promise<unknown>
  alExito: () => void
  onCerrar: () => void
  children: ReactNode
}

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.'
}

/** Si guarda bien muestra el aviso, recarga y cierra; si falla, el error queda dentro del diálogo. */
export function FormularioDialogo(p: FormularioDialogoProps) {
  const mostrarAviso = useAviso()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function alEnviar(ev: FormEvent) {
    ev.preventDefault()
    if (enviando) return
    const invalido = p.validar?.() ?? null
    if (invalido) {
      setError(invalido)
      return
    }
    setError('')
    setEnviando(true)
    try {
      await p.enviar()
    } catch (e: unknown) {
      setError(mensajeDe(e))
      setEnviando(false)
      return
    }
    mostrarAviso(p.exito)
    p.alExito()
    p.onCerrar()
  }

  return (
    <Dialogo titulo={p.titulo} onCerrar={p.onCerrar}>
      <form onSubmit={(ev) => void alEnviar(ev)} noValidate>
        {p.children}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-acciones">
          <button type="button" className="btn" onClick={p.onCerrar}>
            Cancelar
          </button>
          <button type="submit" className={`btn ${p.peligro ? 'btn-peligro' : 'btn-primario'}`} disabled={enviando}>
            {enviando ? 'Guardando…' : (p.textoEnviar ?? 'Guardar')}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}
