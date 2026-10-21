import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase, faltanVariables } from '../lib/supabase'
import { obtenerPerfil } from '../data/consultas'
import type { PerfilUsuario } from '../data/tipos'

interface Sesion {
  usuario: User | null
  perfil: PerfilUsuario | null
  errorPerfil: boolean
  cargando: boolean
  salir: () => Promise<void>
}

const Contexto = createContext<Sesion | null>(null)

export function useSesion(): Sesion {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useSesion debe usarse dentro de SesionProvider')
  return ctx
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null)
  const [cargando, setCargando] = useState(!faltanVariables)
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null)
  const [errorPerfil, setErrorPerfil] = useState(false)

  useEffect(() => {
    if (faltanVariables) return
    const sb = getSupabase()
    let vigente = true
    sb.auth.getSession().then(
      ({ data }) => {
        if (!vigente) return
        setUsuario(data.session?.user ?? null)
        setCargando(false)
      },
      () => {
        if (vigente) setCargando(false)
      },
    )
    // Dentro del callback solo se actualiza estado: llamar a Supabase aquí puede bloquear.
    const { data: sub } = sb.auth.onAuthStateChange((_evento, s) => setUsuario(s?.user ?? null))
    return () => {
      vigente = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const usuarioId = usuario?.id ?? null
  useEffect(() => {
    setPerfil(null)
    setErrorPerfil(false)
    if (!usuarioId) return
    let vigente = true
    obtenerPerfil(usuarioId).then(
      (p) => {
        if (vigente) setPerfil(p)
      },
      () => {
        if (vigente) setErrorPerfil(true)
      },
    )
    return () => {
      vigente = false
    }
  }, [usuarioId])

  const valor = useMemo<Sesion>(
    () => ({
      usuario,
      perfil,
      errorPerfil,
      cargando,
      salir: async () => {
        await getSupabase().auth.signOut()
      },
    }),
    [usuario, perfil, errorPerfil, cargando],
  )
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}
