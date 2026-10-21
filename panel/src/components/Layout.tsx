import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSesion } from '../auth/SesionProvider'
import { Pagina } from './Animaciones'

const ENLACES = [
  { a: '/', texto: 'Resumen', corto: 'Resumen' },
  { a: '/inventario', texto: 'Inventario', corto: 'Inventario' },
  { a: '/animales', texto: 'Animales', corto: 'Animales' },
  { a: '/tratamientos', texto: 'Tratamientos', corto: 'Trat.' },
  { a: '/auditoria', texto: 'Auditoría', corto: 'Auditoría' },
]

function Enlaces({ corto }: { corto?: boolean }) {
  return (
    <>
      {ENLACES.map((e) => (
        <NavLink key={e.a} to={e.a} end={e.a === '/'} aria-label={corto ? e.texto : undefined}>
          {corto ? e.corto : e.texto}
        </NavLink>
      ))}
    </>
  )
}

export function Layout() {
  const { perfil, errorPerfil, salir } = useSesion()
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)

  useEffect(() => setMenuAbierto(false), [pathname])
  useEffect(() => {
    if (!menuAbierto) return
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAbierto(false)
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [menuAbierto])

  const rol = perfil ? perfil.rol : errorPerfil ? 'no disponible' : 'cargando…'

  return (
    <div className="app">
      <header className="cabecera">
        <button
          type="button"
          className="btn btn-menu"
          aria-expanded={menuAbierto}
          aria-controls="nav-lateral"
          onClick={() => setMenuAbierto((v) => !v)}
        >
          Menú
        </button>
        <span className="marca">Moncopulli</span>
        <p className="usuario">
          {perfil && <span className="usuario-nombre">{perfil.nombres} · </span>}
          Rol: <strong>{rol}</strong>
        </p>
        <button type="button" className="btn btn-salir-cabecera" onClick={() => void salir()}>
          Cerrar sesión
        </button>
      </header>

      <nav id="nav-lateral" className={`nav-lateral${menuAbierto ? ' abierto' : ''}`} aria-label="Principal">
        <Enlaces />
      </nav>

      <main className="principal">
        <Pagina key={pathname}>
          <Outlet />
        </Pagina>
      </main>

      <nav className="nav-inferior" aria-label="Principal (móvil)">
        <Enlaces corto />
        <button type="button" onClick={() => void salir()} aria-label="Cerrar sesión">
          Salir
        </button>
      </nav>
    </div>
  )
}
