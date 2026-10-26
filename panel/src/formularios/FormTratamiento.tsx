import { useRef, useState } from 'react'
import { aNumero, CampoArea, CampoSelect, CampoTexto } from '../components/Campos'
import { Dialogo } from '../components/Dialogo'
import { ErrorCarga, Esqueleto } from '../components/Estado'
import { FormularioDialogo } from '../components/FormularioDialogo'
import { listarAnimales, listarMedicamentos } from '../data/consultas'
import { ejecutar } from '../data/ejecutar'
import type { Animal, Medicamento } from '../data/tipos'
import { useConsulta } from '../data/useConsulta'
import { aValorLocal, generarRepeticiones, localAISO, MAX_DOSIS } from '../lib/dosis'
import { textoDiio } from '../lib/formato'
import { opcional, type PropsForm } from './base'

interface Props extends PropsForm {
  /** Animal ya elegido (desde el detalle del animal). */
  animalInicial: Animal | null
}

interface FilaDosis {
  clave: number
  medicamentoId: string
  cantidad: string
  fecha: string
}

const MAX_OPCIONES = 50

function CuerpoTratamiento({ animalInicial, animales, medicamentos, onCerrar, alExito }: Props & { animales: Animal[]; medicamentos: Medicamento[] }) {
  const contador = useRef(1)
  const nuevaFila = (base?: Partial<FilaDosis>): FilaDosis => ({
    clave: contador.current++,
    medicamentoId: '',
    cantidad: '',
    fecha: aValorLocal(new Date()),
    ...base,
  })
  const [busca, setBusca] = useState('')
  const [animalId, setAnimalId] = useState(animalInicial ? String(animalInicial.id) : '')
  const [indicadoPor, setIndicadoPor] = useState('')
  const [receta, setReceta] = useState('')
  const [motivo, setMotivo] = useState('')
  const [obs, setObs] = useState('')
  const [filas, setFilas] = useState<FilaDosis[]>(() => [nuevaFila()])
  const [cada, setCada] = useState('8')
  const [veces, setVeces] = useState('3')

  const t = busca.trim().toLowerCase()
  const opciones = animales.filter((a) => !t || (a.diio ?? '').includes(t)).slice(0, MAX_OPCIONES)
  const seleccionado = animales.find((a) => String(a.id) === animalId)
  if (seleccionado && !opciones.includes(seleccionado)) opciones.unshift(seleccionado)
  const unidad = (id: string): string => medicamentos.find((m) => String(m.id) === id)?.unidad_base ?? ''

  const cambiarFila = (clave: number, cambio: Partial<FilaDosis>) =>
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)))

  function repetir() {
    const base = filas[0]
    const inicio = new Date(base.fecha)
    const fechas = generarRepeticiones(inicio, aNumero(cada), aNumero(veces))
    if (fechas.length === 0) return false
    setFilas(fechas.map((d) => nuevaFila({ medicamentoId: base.medicamentoId, cantidad: base.cantidad, fecha: aValorLocal(d) })))
    return true
  }

  function validar(): string | null {
    if (!animalId) return 'Elige el animal.'
    if (!indicadoPor.trim()) return 'Indica quién prescribe el tratamiento.'
    if (filas.length === 0) return 'Agrega al menos una dosis.'
    for (const [i, f] of filas.entries()) {
      if (!f.medicamentoId) return `Dosis ${i + 1}: elige el medicamento.`
      if (!(aNumero(f.cantidad) > 0)) return `Dosis ${i + 1}: la cantidad debe ser mayor que 0.`
      if (!localAISO(f.fecha)) return `Dosis ${i + 1}: indica la fecha y hora.`
    }
    return null
  }

  const enviar = () =>
    ejecutar('fn_crear_tratamiento', {
      p_animal_id: Number(animalId),
      p: { indicado_por: indicadoPor.trim(), numero_receta: opcional(receta), motivo: opcional(motivo), observaciones: opcional(obs) },
      p_dosis: filas.map((f) => ({
        medicamento_id: Number(f.medicamentoId),
        cantidad: aNumero(f.cantidad),
        fecha_programada: localAISO(f.fecha),
      })),
    })

  return (
    <FormularioDialogo
      titulo="Nuevo tratamiento"
      textoEnviar="Crear tratamiento"
      exito="Tratamiento creado."
      validar={validar}
      enviar={enviar}
      alExito={alExito}
      onCerrar={onCerrar}
    >
      {animalInicial ? (
        <p>Animal: <strong>{textoDiio(animalInicial.diio)}</strong></p>
      ) : (
        <>
          <CampoTexto etiqueta="Buscar animal por DIIO" type="search" autoComplete="off" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <CampoSelect etiqueta="Animal" value={animalId} onChange={(e) => setAnimalId(e.target.value)} ayuda={`Se muestran hasta ${MAX_OPCIONES} animales activos; afina la búsqueda.`}>
            <option value="">Elige un animal</option>
            {opciones.map((a) => (
              <option key={a.id} value={a.id}>{a.diio ? textoDiio(a.diio) : `Sin DIIO (n.º ${a.id})`}</option>
            ))}
          </CampoSelect>
        </>
      )}
      <CampoTexto etiqueta="Indicado por" value={indicadoPor} onChange={(e) => setIndicadoPor(e.target.value)} maxLength={120} ayuda="Veterinario o persona que prescribe." />
      <CampoTexto etiqueta="N.º de receta (opcional)" value={receta} onChange={(e) => setReceta(e.target.value)} maxLength={40} />
      <CampoTexto etiqueta="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ej.: mastitis" />
      <CampoArea etiqueta="Observaciones (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />

      <fieldset className="dosis-grupo">
        <legend>Dosis ({filas.length})</legend>
        {filas.map((f, i) => (
          <div key={f.clave} className="dosis-fila">
            <CampoSelect etiqueta={`Medicamento (dosis ${i + 1})`} value={f.medicamentoId} onChange={(e) => cambiarFila(f.clave, { medicamentoId: e.target.value })}>
              <option value="">Elige</option>
              {medicamentos.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre_comercial}</option>
              ))}
            </CampoSelect>
            <CampoTexto
              etiqueta={`Cantidad${unidad(f.medicamentoId) ? ` (${unidad(f.medicamentoId)})` : ''}`}
              type="number" inputMode="decimal" step="0.01" min="0.01"
              value={f.cantidad} onChange={(e) => cambiarFila(f.clave, { cantidad: e.target.value })}
            />
            <CampoTexto etiqueta="Fecha y hora" type="datetime-local" value={f.fecha} onChange={(e) => cambiarFila(f.clave, { fecha: e.target.value })} />
            <button type="button" className="btn btn-chico" disabled={filas.length === 1} onClick={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))}>
              Quitar dosis {i + 1}
            </button>
          </div>
        ))}
        <button type="button" className="btn" disabled={filas.length >= MAX_DOSIS} onClick={() => setFilas((fs) => [...fs, nuevaFila()])}>
          Agregar dosis
        </button>
        <div className="dosis-repetir">
          <p className="muted">Repetir la primera dosis: reemplaza las filas por una serie con el mismo medicamento y cantidad.</p>
          <CampoTexto etiqueta="Cada (horas)" type="number" step="1" min="1" value={cada} onChange={(e) => setCada(e.target.value)} />
          <CampoTexto etiqueta="Veces" type="number" step="1" min="1" max={MAX_DOSIS} value={veces} onChange={(e) => setVeces(e.target.value)} />
          <button type="button" className="btn" onClick={repetir}>
            Repetir cada {cada || 'N'} horas, {veces || 'X'} veces
          </button>
        </div>
      </fieldset>
    </FormularioDialogo>
  )
}

/** Carga animales activos y medicamentos activos, y luego muestra el formulario. */
export function FormTratamiento(props: Props) {
  const anim = useConsulta(listarAnimales, [])
  const meds = useConsulta(listarMedicamentos, [])
  if (anim.estado === 'error' || meds.estado === 'error') {
    return (
      <Dialogo titulo="Nuevo tratamiento" onCerrar={props.onCerrar}>
        <ErrorCarga onReintentar={() => { anim.recargar(); meds.recargar() }} />
        <div className="form-acciones">
          <button type="button" className="btn" onClick={props.onCerrar}>Cerrar</button>
        </div>
      </Dialogo>
    )
  }
  if (!anim.datos || !meds.datos) {
    return (
      <Dialogo titulo="Nuevo tratamiento" onCerrar={props.onCerrar}>
        <Esqueleto filas={4} />
      </Dialogo>
    )
  }
  const activos = anim.datos.filter((a) => a.fecha_baja === null)
  return <CuerpoTratamiento {...props} animales={activos} medicamentos={meds.datos} />
}
