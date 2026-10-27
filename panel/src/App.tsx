import { lazy, type ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { SesionProvider, useSesion } from './auth/SesionProvider'
import { Layout } from './components/Layout'
import { Esqueleto } from './components/Estado'
import { faltanVariables, MENSAJE_CONFIG } from './lib/supabase'
import { puedeAuditar, puedeOperar } from './lib/permisos'
import { Login } from './pages/Login'
import { NoEncontrado } from './pages/NoEncontrado'
import { Resumen } from './pages/Resumen'

// Las pantallas se cargan al abrirlas, para que el inicio descargue menos código
const Alertas = lazy(() => import('./pages/Alertas').then((m) => ({ default: m.Alertas })))
const Animales = lazy(() => import('./pages/Animales').then((m) => ({ default: m.Animales })))
const Auditoria = lazy(() => import('./pages/Auditoria').then((m) => ({ default: m.Auditoria })))
const Exportar = lazy(() => import('./pages/Exportar').then((m) => ({ default: m.Exportar })))
const Inventario = lazy(() => import('./pages/Inventario').then((m) => ({ default: m.Inventario })))
const Maestros = lazy(() => import('./pages/Maestros').then((m) => ({ default: m.Maestros })))
const Tratamientos = lazy(() => import('./pages/Tratamientos').then((m) => ({ default: m.Tratamientos })))

function RequiereSesion() {
  const { usuario, cargando } = useSesion()
  if (cargando) {
    return (
      <div className="pantalla-centrada">
        <Esqueleto filas={3} />
      </div>
    )
  }
  return usuario ? <Layout /> : <Navigate to="/login" replace />
}

/** Oculta la pantalla a los roles sin permiso (el servidor igual lo impide). */
function Protegida({ permitido, children }: { permitido: (rol: string) => boolean; children: ReactElement }) {
  const { perfil, errorPerfil } = useSesion()
  if (errorPerfil) return <Navigate to="/" replace />
  if (!perfil) return <Esqueleto filas={3} />
  return permitido(perfil.rol) ? children : <Navigate to="/" replace />
}

function PantallaConfig() {
  return (
    <div className="pantalla-centrada">
      <div role="alert" className="error-caja">
        <h1>Configuración incompleta</h1>
        <p>{MENSAJE_CONFIG}</p>
      </div>
    </div>
  )
}

export default function App() {
  if (faltanVariables) return <PantallaConfig />
  return (
    <SesionProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequiereSesion />}>
          <Route index element={<Resumen />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="animales" element={<Animales />} />
          <Route path="tratamientos" element={<Tratamientos />} />
          <Route path="alertas" element={<Protegida permitido={puedeOperar}><Alertas /></Protegida>} />
          <Route path="maestros" element={<Protegida permitido={puedeOperar}><Maestros /></Protegida>} />
          <Route path="auditoria" element={<Protegida permitido={puedeAuditar}><Auditoria /></Protegida>} />
          <Route path="exportar" element={<Protegida permitido={puedeAuditar}><Exportar /></Protegida>} />
          <Route path="*" element={<NoEncontrado />} />
        </Route>
      </Routes>
    </SesionProvider>
  )
}
