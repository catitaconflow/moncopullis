import { Insignia } from './Estado'
import { Tabla, type Columna } from './Tabla'
import { formatoFechaHora } from '../lib/formato'
import type { Tratamiento } from '../data/tipos'

function EstadoTratamiento({ t }: { t: Tratamiento }) {
  return t.fecha_anulacion ? <Insignia tono="error">Anulado</Insignia> : <Insignia tono="ok">Vigente</Insignia>
}

export function TablaTratamientos({ filas, conAnimal }: { filas: Tratamiento[]; conAnimal: boolean }) {
  const animal: Columna<Tratamiento> = { titulo: 'Animal', render: (t) => t.animal?.diio.trim() ?? '—' }
  const columnas: Columna<Tratamiento>[] = [
    ...(conAnimal ? [animal] : []),
    { titulo: 'Fecha', render: (t) => formatoFechaHora(t.fecha_creacion) },
    { titulo: 'Motivo', render: (t) => t.motivo ?? '—' },
    { titulo: 'Estado', render: (t) => <EstadoTratamiento t={t} /> },
  ]
  return <Tabla caption="Tratamientos" columnas={columnas} filas={filas} clave={(t) => t.id} />
}
