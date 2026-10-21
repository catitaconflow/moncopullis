import { useCallback, useEffect, useState, type DependencyList } from 'react'

export interface Consulta<T> {
  estado: 'cargando' | 'error' | 'ok'
  datos: T | null
  recargar: () => void
}

/** Ejecuta `fn` al montar y cuando cambian `deps`. Ignora respuestas obsoletas. */
export function useConsulta<T>(fn: () => Promise<T>, deps: DependencyList): Consulta<T> {
  const [estado, setEstado] = useState<Consulta<T>['estado']>('cargando')
  const [datos, setDatos] = useState<T | null>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    setEstado('cargando')
    fn().then(
      (d) => {
        if (!vigente) return
        setDatos(d)
        setEstado('ok')
      },
      () => {
        if (!vigente) return
        setDatos(null)
        setEstado('error')
      },
    )
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intento])

  const recargar = useCallback(() => setIntento((n) => n + 1), [])
  return { estado, datos, recargar }
}
