import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSesion } from '../auth/SesionProvider'
import { Pagina } from './Animaciones'
import { AvisoProvider } from './Avisos'
import { VincularTelegram } from './VincularTelegram'
import { puedeOperar } from '../lib/permisos'
import { Esqueleto } from './Estado'

// Trazos de 24x24 (estilo línea), dibujados con currentColor.
interface Enlace {
  a: string
  texto: string
  corto: string
  icono: string
  /** Roles que ven el enlace. */
  roles: string[]
  /** Aparece en la barra inferior del móvil; el resto va en el menú "Más". */
  principal?: boolean
}

const TODOS = ['ADMIN', 'OPERARIO', 'AUDITOR']
const ENLACES: Enlace[] = [
  { a: '/', texto: 'Resumen', corto: 'Resumen', icono: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z', roles: TODOS, principal: true },
  { a: '/inventario', texto: 'Inventario', corto: 'Inventario', icono: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10', roles: TODOS, principal: true },
  { a: '/animales', texto: 'Animales', corto: 'Animales', icono: 'M5 9a7 6 0 0 0 14 0M7 9V6l-3-2M17 9V6l3-2M8 15a4 3 0 0 0 8 0M10 12h.01M14 12h.01', roles: TODOS, principal: true },
  { a: '/tratamientos', texto: 'Tratamientos', corto: 'Trat.', icono: 'M17 3l4 4M19 5l-9 9M14 6l4 4M6 14l4 4M3 21l4-4M7 13l4 4', roles: TODOS, principal: true },
  { a: '/alertas', texto: 'Alertas', corto: 'Alertas', icono: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4', roles: ['ADMIN', 'OPERARIO'] },
  { a: '/maestros', texto: 'Maestros', corto: 'Maestros', icono: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3', roles: ['ADMIN', 'OPERARIO'] },
  { a: '/auditoria', texto: 'Auditoría', corto: 'Auditoría', icono: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4', roles: ['ADMIN', 'AUDITOR'] },
  { a: '/exportar', texto: 'Exportar', corto: 'Exportar', icono: 'M12 4v11M7 11l5 5 5-5M5 20h14', roles: ['ADMIN', 'AUDITOR'] },
]

/** Enlaces visibles para un rol (mientras el perfil carga, solo los comunes). */
export function enlacesPara(rol: string | null | undefined): Enlace[] {
  return ENLACES.filter((e) => (rol ? e.roles.includes(rol) : e.roles === TODOS))
}

const ICONO_MAS = 'M5 12h.01M12 12h.01M19 12h.01'

function Icono({ d }: { d: string }) {
  return (
    <svg className="icono" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Enlaces({ enlaces, corto }: { enlaces: Enlace[]; corto?: boolean }) {
  return (
    <>
      {enlaces.map((e) => (
        <NavLink key={e.a} to={e.a} end={e.a === '/'} aria-label={corto ? e.texto : undefined}>
          <Icono d={e.icono} />
          <span>{corto ? e.corto : e.texto}</span>
        </NavLink>
      ))}
    </>
  )
}

export function Layout() {
  const { usuario, perfil, errorPerfil, salir } = useSesion()
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [masAbierto, setMasAbierto] = useState(false)

  useEffect(() => {
    setMenuAbierto(false)
    setMasAbierto(false)
  }, [pathname])
  useEffect(() => {
    if (!menuAbierto && !masAbierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMenuAbierto(false)
      setMasAbierto(false)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [menuAbierto, masAbierto])

  const enlaces = enlacesPara(perfil?.rol)
  const rol = perfil ? perfil.rol : errorPerfil ? 'no disponible' : 'cargando…'

  return (
    <AvisoProvider>
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
        {puedeOperar(rol) && usuario?.email && <VincularTelegram correo={usuario.email} />}
        <button type="button" className="btn btn-salir-cabecera" onClick={() => void salir()}>
          Cerrar sesión
        </button>
      </header>

      <nav id="nav-lateral" className={`nav-lateral${menuAbierto ? ' abierto' : ''}`} aria-label="Principal">
        <Enlaces enlaces={enlaces} />
      </nav>

      <main className="principal">
        <Pagina key={pathname}>
          <Suspense fallback={<Esqueleto filas={4} />}>
            <Outlet />
          </Suspense>
        </Pagina>
      </main>

      <nav className="nav-inferior" aria-label="Principal (móvil)">
        <Enlaces enlaces={enlaces.filter((e) => e.principal)} corto />
        <button
          type="button"
          aria-expanded={masAbierto}
          aria-controls="menu-mas"
          aria-label="Más opciones"
          onClick={() => setMasAbierto((v) => !v)}
        >
          <Icono d={ICONO_MAS} />
          <span>Más</span>
        </button>
      </nav>
      {masAbierto && (
        <div id="menu-mas" className="menu-mas" role="group" aria-label="Más opciones">
          <Enlaces enlaces={enlaces.filter((e) => !e.principal)} />
          {puedeOperar(rol) && usuario?.email && <VincularTelegram correo={usuario.email} clase="" />}
          <button type="button" onClick={() => void salir()}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
    </AvisoProvider>
  )
}
