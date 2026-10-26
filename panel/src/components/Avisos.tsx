import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

const DURACION_MS = 4000

type Mostrar = (mensaje: string) => void
const Contexto = createContext<Mostrar | null>(null)

export function useAviso(): Mostrar {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useAviso debe usarse dentro de AvisoProvider')
  return ctx
}

/** Aviso de éxito breve: región role="status" que se oculta sola a los ~4 s. */
export function Aviso({ mensaje }: { mensaje: string }) {
  return (
    <div role="status" className={`aviso${mensaje ? ' aviso-visible' : ''}`}>
      {mensaje}
    </div>
  )
}

export function AvisoProvider({ children }: { children: ReactNode }) {
  const [mensaje, setMensaje] = useState('')
  const temporizador = useRef<number | undefined>(undefined)

  const mostrar = useCallback<Mostrar>((m) => {
    window.clearTimeout(temporizador.current)
    setMensaje(m)
    temporizador.current = window.setTimeout(() => setMensaje(''), DURACION_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(temporizador.current), [])
  const valor = useMemo(() => mostrar, [mostrar])

  return (
    <Contexto.Provider value={valor}>
      {children}
      <Aviso mensaje={mensaje} />
    </Contexto.Provider>
  )
}
