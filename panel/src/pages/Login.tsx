import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useSesion } from '../auth/SesionProvider'
import { Pagina } from '../components/Animaciones'
import { getSupabase } from '../lib/supabase'

export function Login() {
  const { usuario, cargando } = useSesion()
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!cargando && usuario) return <Navigate to="/" replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      const { error: err } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password: clave })
      if (err) {
        setError(
          err.status === 400
            ? 'Correo o contraseña incorrectos.'
            : 'No se pudo iniciar sesión. Inténtalo de nuevo en unos minutos.',
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
          <h1>Moncopulli</h1>
          <p className="muted">Panel de consulta. Ingresa con tu cuenta.</p>
          <form onSubmit={(e) => void enviar(e)} noValidate>
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="clave">Contraseña</label>
            <input
              id="clave"
              type="password"
              autoComplete="current-password"
              required
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
            <div aria-live="assertive" className="mensaje-error">
              {error}
            </div>
            <button type="submit" className="btn btn-primario" disabled={enviando || !email || !clave}>
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </main>
      </Pagina>
    </div>
  )
}
