import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ErrorCarga, Esqueleto } from '../components/Estado'
import {
  contarAnimalesActivos,
  contarLotesPorVencer,
  contarMedicamentosBajoMinimo,
  contarTratamientosAbiertos,
} from '../data/consultas'
import { useConsulta } from '../data/useConsulta'
import { formatoNumero } from '../lib/formato'

interface CifraProps {
  titulo: string
  ayuda: string
  vacio: string
  a: string
  cargar: () => Promise<number>
  /** La cifra es una alerta cuando es mayor que cero. */
  alerta?: boolean
}

function Cifra({ titulo, ayuda, vacio, a, cargar, alerta }: CifraProps) {
  const q = useConsulta(cargar, [])
  const id = useId()
  return (
    <section className="cifra" aria-labelledby={id}>
      <h2 id={id}>{titulo}</h2>
      {q.estado === 'cargando' && <Esqueleto filas={1} />}
      {q.estado === 'error' && <ErrorCarga onReintentar={q.recargar} mensaje="No se pudo obtener la cifra." />}
      {q.estado === 'ok' && q.datos !== null && (
        <>
          <p className={`cifra-valor${alerta && q.datos > 0 ? ' cifra-alerta' : ''}`}>{formatoNumero(q.datos)}</p>
          <p className="muted">{q.datos === 0 ? vacio : ayuda}</p>
        </>
      )}
      <Link to={a}>Ver detalle</Link>
    </section>
  )
}

export function Resumen() {
  return (
    <>
      <h1>Resumen</h1>
      <div className="cifras">
        <Cifra
          titulo="Medicamentos bajo el mínimo"
          ayuda="Stock actual menor al stock mínimo."
          vacio="Todos los medicamentos están sobre su mínimo."
          a="/inventario"
          cargar={contarMedicamentosBajoMinimo}
          alerta
        />
        <Cifra
          titulo="Lotes por vencer"
          ayuda="Con stock y vencimiento en 60 días o menos (incluye vencidos)."
          vacio="Ningún lote con stock vence en los próximos 60 días."
          a="/inventario"
          cargar={contarLotesPorVencer}
          alerta
        />
        <Cifra
          titulo="Animales activos"
          ayuda="Animales sin fecha de baja."
          vacio="No hay animales activos registrados."
          a="/animales"
          cargar={contarAnimalesActivos}
        />
        <Cifra
          titulo="Tratamientos abiertos"
          ayuda="No anulados y con dosis programadas pendientes."
          vacio="No hay tratamientos con dosis pendientes."
          a="/tratamientos"
          cargar={contarTratamientosAbiertos}
        />
      </div>
    </>
  )
}
