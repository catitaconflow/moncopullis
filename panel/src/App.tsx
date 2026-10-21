import { Navigate, Route, Routes } from 'react-router-dom'
import { SesionProvider, useSesion } from './auth/SesionProvider'
import { Layout } from './components/Layout'
import { Esqueleto } from './components/Estado'
import { faltanVariables, MENSAJE_CONFIG } from './lib/supabase'
import { Animales } from './pages/Animales'
import { Auditoria } from './pages/Auditoria'
import { Inventario } from './pages/Inventario'
import { Login } from './pages/Login'
import { NoEncontrado } from './pages/NoEncontrado'
import { Resumen } from './pages/Resumen'
import { Tratamientos } from './pages/Tratamientos'

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
          <Route path="auditoria" element={<Auditoria />} />
          <Route path="*" element={<NoEncontrado />} />
        </Route>
      </Routes>
    </SesionProvider>
  )
}
