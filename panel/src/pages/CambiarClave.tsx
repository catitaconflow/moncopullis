import { useState, type FormEvent } from 'react'
import { useSesion } from '../auth/SesionProvider'
import { Pagina } from '../components/Animaciones'
import { getSupabase } from '../lib/supabase'

const MINIMO = 10

/** Primer ingreso con contraseña temporal: no deja usar el panel hasta cambiarla. */
export function CambiarClave() {
  const { salir } = useSesion()
  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (clave.length < MINIMO) return setError(`La contraseña debe tener al menos ${MINIMO} caracteres.`)
    if (clave !== repetida) return setError('Las contraseñas no coinciden.')
    setEnviando(true)
    setError(null)
    try {
      // onAuthStateChange entrega el usuario sin la marca y RequiereSesion muestra el panel.
      const { error: err } = await getSupabase().auth.updateUser({ password: clave, data: { debe_cambiar_clave: false } })
      if (err) {
        setError(
          err.code === 'same_password'
            ? 'La nueva contraseña debe ser distinta de la temporal.'
            : err.code === 'weak_password'
              ? 'La contraseña es muy débil. Usa una más larga o con más variedad.'
              : 'No se pudo cambiar la contraseña. Inténtalo de nuevo.',
        )
      }
    } catch {
      setError('No se pudo conectar con el servidor. Revisa tu conexión.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pantalla-centrada">
      <Pagina>
        <main className="login">
          <h1>Cambia tu contraseña</h1>
          <p className="muted">Entraste con una contraseña temporal. Elige una nueva de al menos {MINIMO} caracteres para seguir.</p>
          <form onSubmit={(e) => void enviar(e)} noValidate>
            <label htmlFor="clave-nueva">Nueva contraseña</label>
            <input
              id="clave-nueva"
              type="password"
              autoComplete="new-password"
              minLength={MINIMO}
              required
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
            <label htmlFor="clave-repetida">Repite la contraseña</label>
            <input
              id="clave-repetida"
              type="password"
              autoComplete="new-password"
              required
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
            />
            <div aria-live="assertive" className="mensaje-error">
              {error}
            </div>
            <button type="submit" className="btn btn-primario" disabled={enviando || !clave || !repetida}>
              {enviando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
            <button type="button" className="btn" onClick={() => void salir()}>
              Salir
            </button>
          </form>
        </main>
      </Pagina>
    </div>
  )
}
