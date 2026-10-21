import { Vista } from '../components/Estado'
import { TablaTratamientos } from '../components/TablaTratamientos'
import { listarTratamientos } from '../data/consultas'
import { useConsulta } from '../data/useConsulta'

export function Tratamientos() {
  const q = useConsulta(listarTratamientos, [])
  return (
    <>
      <h1>Tratamientos</h1>
      <Vista q={q} mensajeVacio="Aún no hay tratamientos registrados.">
        {(filas) => (
          <>
            <p className="muted">Últimos {filas.length} tratamientos, del más reciente al más antiguo.</p>
            <TablaTratamientos filas={filas} conAnimal />
          </>
        )}
      </Vista>
    </>
  )
}
