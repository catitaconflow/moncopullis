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
    <div className="login-pantalla">
      <header className="login-portada">
        <span className="login-logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="48" height="48" focusable="false">
            <path d="M5 9a7 6 0 0 0 14 0M7 9V6l-3-2M17 9V6l3-2M8 15a4 3 0 0 0 8 0M10 12h.01M14 12h.01" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h1>Moncopulli</h1>
        <p>Medicamentos y tratamientos del campo</p>
      </header>
      <Pagina>
        <main className="login">
          <h2>Iniciar sesión</h2>
          <p className="muted">Usa la misma cuenta de la app móvil.</p>
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
        <p className="login-pie">Agrícola Moncopulli · Puyehue</p>
      </Pagina>
    </div>
  )
}
