import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ErrorCarga, Esqueleto, Insignia, Vista } from '../components/Estado'
import { BarraStock } from '../components/Filtros'
import { useSesion } from '../auth/SesionProvider'
import {
  contarAlertasAbiertas,
  contarAnimalesActivos,
  contarLotesPorVencer,
  contarMedicamentosBajoMinimo,
  contarTratamientosAbiertos,
  listarLotesPorVencer,
  listarMedicamentos,
  listarTratamientos,
} from '../data/consultas'
import { useConsulta } from '../data/useConsulta'
import { formatoFecha, formatoFechaHora, formatoNumero, textoDiio } from '../lib/formato'
import { puedeOperar } from '../lib/permisos'
import { DIAS_ALERTA, diasParaVencer, estadoStock } from '../lib/vencimiento'

const MAX_LISTA = 5

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
  const enAlerta = alerta && q.estado === 'ok' && (q.datos ?? 0) > 0
  const tono = q.estado !== 'ok' ? '' : enAlerta ? ' cifra-tono-alerta' : alerta ? ' cifra-tono-ok' : ''

  if (q.estado === 'error') {
    return (
      <section className="cifra" aria-labelledby={id}>
        <h2 id={id}>{titulo}</h2>
        <ErrorCarga onReintentar={q.recargar} mensaje="No se pudo obtener la cifra." />
      </section>
    )
  }

  return (
    <Link to={a} className={`cifra cifra-enlace${tono}`} aria-labelledby={id}>
      <h2 id={id}>{titulo}</h2>
      {q.estado === 'cargando' || q.datos === null ? (
        <Esqueleto filas={1} />
      ) : (
        <>
          <p className={`cifra-valor${enAlerta ? ' cifra-alerta' : ''}`}>{formatoNumero(q.datos)}</p>
          <p className="muted">{q.datos === 0 ? vacio : ayuda}</p>
        </>
      )}
      <span className="cifra-ir" aria-hidden="true">Ver detalle →</span>
    </Link>
  )
}

function DiasLote({ fecha }: { fecha: string }) {
  const d = diasParaVencer(fecha)
  if (d === null) return <Insignia tono="neutro">Sin fecha</Insignia>
  if (d < 0) return <Insignia tono="error">Vencido hace {-d} {d === -1 ? 'día' : 'días'}</Insignia>
  if (d === 0) return <Insignia tono="error">Vence hoy</Insignia>
  return <Insignia tono="alerta">Vence en {d} {d === 1 ? 'día' : 'días'}</Insignia>
}

function BajoMinimo() {
  const q = useConsulta(listarMedicamentos, [])
  return (
    <section className="panel-lista" aria-labelledby="t-bajo">
      <h2 id="t-bajo">Medicamentos bajo el mínimo</h2>
      <Vista
        q={q}
        filasEsqueleto={3}
        mensajeVacio="Todo el stock está sobre su mínimo."
        esVacio={(meds) => !meds.some((m) => estadoStock(m.stock_actual, m.stock_minimo) === 'bajo')}
      >
        {(meds) => {
          const bajos = meds.filter((m) => estadoStock(m.stock_actual, m.stock_minimo) === 'bajo')
          return (
            <ul className="lista">
              {bajos.slice(0, MAX_LISTA).map((m) => (
                <li key={m.id}>
                  <span className="lista-principal">{m.nombre_comercial}</span>
                  <span className="lista-dato">
                    {formatoNumero(m.stock_actual)} / {formatoNumero(m.stock_minimo)} {m.unidad_base}
                  </span>
                  <BarraStock actual={m.stock_actual} minimo={m.stock_minimo} />
                </li>
              ))}
              {bajos.length > MAX_LISTA && (
                <li className="lista-mas">
                  <Link to="/inventario?filtro=bajo">Ver los {bajos.length} en Inventario</Link>
                </li>
              )}
            </ul>
          )
        }}
      </Vista>
    </section>
  )
}

function PorVencer() {
  const q = useConsulta(() => listarLotesPorVencer(MAX_LISTA), [])
  return (
    <section className="panel-lista" aria-labelledby="t-vencer">
      <h2 id="t-vencer">Lotes por vencer ({DIAS_ALERTA} días)</h2>
      <Vista q={q} filasEsqueleto={3} mensajeVacio="Ningún lote con stock vence pronto.">
        {(lotes) => (
          <ul className="lista">
            {lotes.map((l) => (
              <li key={l.id}>
                <span className="lista-principal">{l.medicamento?.nombre_comercial ?? '—'}</span>
                <span className="lista-dato">
                  Lote {l.numero_lote} · {formatoFecha(l.fecha_vencimiento)}
                </span>
                <DiasLote fecha={l.fecha_vencimiento} />
              </li>
            ))}
          </ul>
        )}
      </Vista>
    </section>
  )
}

function UltimosTratamientos() {
  const q = useConsulta(() => listarTratamientos(MAX_LISTA), [])
  return (
    <section className="panel-lista" aria-labelledby="t-trat">
      <h2 id="t-trat">Últimos tratamientos</h2>
      <Vista q={q} filasEsqueleto={3} mensajeVacio="Aún no hay tratamientos registrados.">
        {(filas) => (
          <ul className="lista">
            {filas.map((t) => (
              <li key={t.id}>
                <span className="lista-principal">Animal {textoDiio(t.animal?.diio)}</span>
                <span className="lista-dato">
                  {t.motivo ?? 'Sin motivo'} · {formatoFechaHora(t.fecha_creacion)}
                </span>
                {t.fecha_anulacion ? <Insignia tono="error">Anulado</Insignia> : <Insignia tono="ok">Vigente</Insignia>}
              </li>
            ))}
            <li className="lista-mas">
              <Link to="/tratamientos">Ver todos los tratamientos</Link>
            </li>
          </ul>
        )}
      </Vista>
    </section>
  )
}

const hoyFmt = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })

export function Resumen() {
  const { perfil } = useSesion()
  return (
    <>
      <header className="encabezado-pagina">
        <h1>{perfil ? `Hola, ${perfil.nombres}` : 'Resumen'}</h1>
        <p className="muted">Estado del campo al {hoyFmt.format(new Date())}.</p>
      </header>
      <div className="cifras">
        <Cifra
          titulo="Medicamentos bajo el mínimo"
          ayuda="Stock actual menor al stock mínimo."
          vacio="Todos los medicamentos están sobre su mínimo."
          a="/inventario?filtro=bajo"
          cargar={contarMedicamentosBajoMinimo}
          alerta
        />
        <Cifra
          titulo="Lotes por vencer"
          ayuda={`Con stock y vencimiento en ${DIAS_ALERTA} días o menos (incluye vencidos).`}
          vacio={`Ningún lote con stock vence en los próximos ${DIAS_ALERTA} días.`}
          a="/inventario"
          cargar={contarLotesPorVencer}
          alerta
        />
        {puedeOperar(perfil?.rol) && (
          <Cifra
            titulo="Alertas abiertas"
            ayuda="Stock bajo, vencimientos y dosis atrasadas por revisar."
            vacio="No hay alertas abiertas."
            a="/alertas"
            cargar={contarAlertasAbiertas}
            alerta
          />
        )}
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

      <h2 className="titulo-seccion">Requiere atención</h2>
      <div className="paneles">
        <BajoMinimo />
        <PorVencer />
        <UltimosTratamientos />
      </div>
    </>
  )
}
