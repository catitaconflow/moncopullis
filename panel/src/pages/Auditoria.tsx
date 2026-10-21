import { useState } from 'react'
import { Vista } from '../components/Estado'
import { Tabla, type Columna } from '../components/Tabla'
import { FILAS_POR_PAGINA, listarAuditoria } from '../data/consultas'
import type { RegistroAuditoria } from '../data/tipos'
import { useConsulta } from '../data/useConsulta'
import { formatoFechaHora } from '../lib/formato'

const columnas: Columna<RegistroAuditoria>[] = [
  { titulo: 'Fecha', render: (r) => formatoFechaHora(r.fecha) },
  { titulo: 'Usuario', render: (r) => (r.usuario ? `${r.usuario.nombres} ${r.usuario.apellidos}` : 'Sistema') },
  { titulo: 'Acción', render: (r) => r.accion },
  { titulo: 'Entidad', render: (r) => r.entidad },
  { titulo: 'Origen', render: (r) => r.origen ?? '—' },
]

export function Auditoria() {
  const [pagina, setPagina] = useState(0)
  const q = useConsulta(() => listarAuditoria(pagina), [pagina])
  const hayMas = (q.datos?.length ?? 0) > FILAS_POR_PAGINA

  return (
    <>
      <h1>Auditoría</h1>
      <Vista
        q={q}
        mensajeVacio={pagina === 0 ? 'Aún no hay registros de auditoría.' : 'No hay más registros.'}
        filasEsqueleto={6}
      >
        {(filas) => (
          <Tabla
            caption={`Auditoría, página ${pagina + 1}`}
            columnas={columnas}
            filas={filas.slice(0, FILAS_POR_PAGINA)}
            clave={(r) => r.id}
          />
        )}
      </Vista>
      <nav className="paginacion" aria-label="Paginación de auditoría">
        <button type="button" className="btn" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
          Anterior
        </button>
        <span>Página {pagina + 1}</span>
        <button type="button" className="btn" disabled={!hayMas} onClick={() => setPagina((p) => p + 1)}>
          Siguiente
        </button>
      </nav>
    </>
  )
}
