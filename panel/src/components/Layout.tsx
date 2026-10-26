import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSesion } from '../auth/SesionProvider'
import { Pagina } from './Animaciones'

// Trazos de 24x24 (estilo línea), dibujados con currentColor.
const ENLACES = [
  { a: '/', texto: 'Resumen', corto: 'Resumen', icono: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z' },
  { a: '/inventario', texto: 'Inventario', corto: 'Inventario', icono: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10' },
  { a: '/animales', texto: 'Animales', corto: 'Animales', icono: 'M5 9a7 6 0 0 0 14 0M7 9V6l-3-2M17 9V6l3-2M8 15a4 3 0 0 0 8 0M10 12h.01M14 12h.01' },
  { a: '/tratamientos', texto: 'Tratamientos', corto: 'Trat.', icono: 'M17 3l4 4M19 5l-9 9M14 6l4 4M6 14l4 4M3 21l4-4M7 13l4 4' },
  { a: '/auditoria', texto: 'Auditoría', corto: 'Auditoría', icono: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4' },
]

function Icono({ d }: { d: string }) {
  return (
    <svg className="icono" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Enlaces({ corto }: { corto?: boolean }) {
  return (
    <>
      {ENLACES.map((e) => (
        <NavLink key={e.a} to={e.a} end={e.a === '/'} aria-label={corto ? e.texto : undefined}>
          <Icono d={e.icono} />
          <span>{corto ? e.corto : e.texto}</span>
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
