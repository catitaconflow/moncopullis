import { Insignia } from './Estado'
import { Tabla, type Columna } from './Tabla'
import { formatoFechaHora, textoDiio } from '../lib/formato'
import type { Tratamiento } from '../data/tipos'

function EstadoTratamiento({ t }: { t: Tratamiento }) {
  return t.fecha_anulacion ? <Insignia tono="error">Anulado</Insignia> : <Insignia tono="ok">Vigente</Insignia>
}

interface Props {
  filas: Tratamiento[]
  conAnimal: boolean
  onSeleccionar?: (t: Tratamiento) => void
  seleccionada?: number | null
}

export function TablaTratamientos({ filas, conAnimal, onSeleccionar, seleccionada }: Props) {
  const animal: Columna<Tratamiento> = { titulo: 'Animal', render: (t) => textoDiio(t.animal?.diio) }
  const columnas: Columna<Tratamiento>[] = [
    ...(conAnimal ? [animal] : []),
    { titulo: 'Fecha', render: (t) => formatoFechaHora(t.fecha_creacion) },
    { titulo: 'Motivo', render: (t) => t.motivo ?? '—' },
    { titulo: 'Estado', render: (t) => <EstadoTratamiento t={t} /> },
  ]
  return <Tabla caption="Tratamientos" columnas={columnas} filas={filas} clave={(t) => t.id} onSeleccionar={onSeleccionar} seleccionada={seleccionada} />
}
