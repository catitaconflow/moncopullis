import { useState } from 'react'
import { CampoArea, CampoCasilla, CampoSelect, CampoTexto, Opciones } from '../components/Campos'
import { Dialogo } from '../components/Dialogo'
import { ErrorCarga, Esqueleto } from '../components/Estado'
import { FormularioDialogo } from '../components/FormularioDialogo'
import { listarAnimales, listarPropietarios } from '../data/consultas'
import { ejecutar } from '../data/ejecutar'
import type { Animal, Propietario } from '../data/tipos'
import { useConsulta } from '../data/useConsulta'
import { CATEGORIAS, ESTADOS_PRODUCTIVOS, MOTIVOS_BAJA, ORIGENES } from '../lib/etiquetas'
import { textoDiio } from '../lib/formato'
import { hoyISO, opcional, type PropsForm } from './base'

interface Props extends PropsForm {
  /** null = animal nuevo. */
  animal: Animal | null
}

interface CuerpoProps extends Props {
  propietarios: Propietario[]
  madres: Animal[]
}

function etiquetaMadre(a: Animal): string {
  return a.diio ? textoDiio(a.diio) : `Sin DIIO (n.º ${a.id})`
}

function CuerpoAnimal({ animal, propietarios, madres, onCerrar, alExito }: CuerpoProps) {
  const [diio, setDiio] = useState(animal?.diio?.trim() ?? '')
  const [categoria, setCategoria] = useState(animal?.categoria ?? 'VACA')
  const [estado, setEstado] = useState(animal?.estado_productivo ?? '')
  const [propietario, setPropietario] = useState(animal?.propietario_id ? String(animal.propietario_id) : '')
  const [nacimiento, setNacimiento] = useState(animal?.fecha_nacimiento ?? '')
  const [madre, setMadre] = useState(animal?.madre_id ? String(animal.madre_id) : '')
  const [origen, setOrigen] = useState(animal?.origen_ingreso ?? 'NACIDO_EN_PREDIO')
  const [obs, setObs] = useState(animal?.observaciones ?? '')

  function validar(): string | null {
    if (diio.trim() && !/^[0-9]{9}$/.test(diio.trim())) return 'El DIIO debe tener 9 dígitos.'
    if (nacimiento && nacimiento > hoyISO()) return 'La fecha de nacimiento no puede ser futura.'
    return null
  }

  const enviar = () =>
    ejecutar('fn_guardar_animal', {
      p_id: animal?.id ?? null,
      p: {
        diio: opcional(diio),
        categoria,
        estado_productivo: categoria === 'VACA' ? opcional(estado) : null,
        propietario_id: propietario ? Number(propietario) : null,
        fecha_nacimiento: opcional(nacimiento),
        madre_id: madre ? Number(madre) : null,
        origen_ingreso: origen,
        observaciones: opcional(obs),
      },
    })

  return (
    <FormularioDialogo
      titulo={animal ? `Editar animal ${textoDiio(animal.diio)}` : 'Nuevo animal'}
      exito={animal ? 'Animal actualizado.' : 'Animal registrado.'}
      validar={validar}
      enviar={enviar}
      alExito={alExito}
      onCerrar={onCerrar}
    >
      <CampoTexto
        etiqueta="DIIO (opcional)"
        inputMode="numeric"
        maxLength={9}
        value={diio}
        onChange={(e) => setDiio(e.target.value)}
        ayuda="9 dígitos. Déjalo vacío si el animal aún no tiene caravana."
      />
      <CampoSelect etiqueta="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
        <Opciones mapa={CATEGORIAS} />
      </CampoSelect>
      {categoria === 'VACA' && (
        <CampoSelect etiqueta="Estado productivo" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Sin definir</option>
          <Opciones mapa={ESTADOS_PRODUCTIVOS} />
        </CampoSelect>
      )}
      <CampoSelect etiqueta="Propietario" value={propietario} onChange={(e) => setPropietario(e.target.value)}>
        <option value="">Propio del predio</option>
        {propietarios.map((p) => (
          <option key={p.id} value={p.id}>{p.nombre_completo}</option>
        ))}
      </CampoSelect>
      <CampoTexto etiqueta="Fecha de nacimiento (opcional)" type="date" max={hoyISO()} value={nacimiento} onChange={(e) => setNacimiento(e.target.value)} />
      <CampoSelect etiqueta="Madre (opcional)" value={madre} onChange={(e) => setMadre(e.target.value)}>
        <option value="">Sin registrar</option>
        {madres.map((m) => (
          <option key={m.id} value={m.id}>{etiquetaMadre(m)}</option>
        ))}
      </CampoSelect>
      <CampoSelect etiqueta="Origen del ingreso" value={origen} onChange={(e) => setOrigen(e.target.value)}>
        <Opciones mapa={ORIGENES} />
      </CampoSelect>
      <CampoArea etiqueta="Observaciones (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
    </FormularioDialogo>
  )
}

/** Carga propietarios activos y posibles madres, y luego muestra el formulario. */
export function FormAnimal(props: Props) {
  const props_ = useConsulta(listarPropietarios, [])
  const anim = useConsulta(listarAnimales, [])
  if (props_.estado === 'error' || anim.estado === 'error') {
    return (
      <Dialogo titulo="Animal" onCerrar={props.onCerrar}>
        <ErrorCarga onReintentar={() => { props_.recargar(); anim.recargar() }} />
        <div className="form-acciones">
          <button type="button" className="btn" onClick={props.onCerrar}>Cerrar</button>
        </div>
      </Dialogo>
    )
  }
  if (!props_.datos || !anim.datos) {
    return (
      <Dialogo titulo="Animal" onCerrar={props.onCerrar}>
        <Esqueleto filas={4} />
      </Dialogo>
    )
  }
  const propietarios = props_.datos.filter((p) => p.activo || p.id === props.animal?.propietario_id)
  const madres = anim.datos.filter((a) => (a.categoria === 'VACA' || a.categoria === 'VAQUILLA') && a.id !== props.animal?.id)
  return <CuerpoAnimal {...props} propietarios={propietarios} madres={madres} />
}

export function FormBaja({ animal, onCerrar, alExito }: { animal: Animal } & PropsForm) {
  const [fecha, setFecha] = useState(hoyISO())
  const [motivo, setMotivo] = useState('VENTA')
  const [confirma, setConfirma] = useState(false)
  const motivos = animal.propietario_id ? MOTIVOS_BAJA : Object.fromEntries(Object.entries(MOTIVOS_BAJA).filter(([k]) => k !== 'DEVOLUCION'))

  function validar(): string | null {
    if (!fecha || fecha > hoyISO()) return 'La fecha de baja es obligatoria y no puede ser futura.'
    return confirma ? null : 'Marca la confirmación para dar de baja al animal.'
  }

  return (
    <FormularioDialogo
      titulo={`Dar de baja al animal ${textoDiio(animal.diio)}`}
      textoEnviar="Dar de baja"
      exito="Animal dado de baja."
      peligro
      validar={validar}
      enviar={() => ejecutar('fn_dar_baja_animal', { p_id: animal.id, p_fecha: fecha, p_motivo: motivo })}
      alExito={alExito}
      onCerrar={onCerrar}
    >
      <CampoTexto etiqueta="Fecha de baja" type="date" max={hoyISO()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <CampoSelect etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
        <Opciones mapa={motivos} />
      </CampoSelect>
      <p className="advertencia">Una vez dado de baja, el animal ya no se puede editar ni tratar.</p>
      <CampoCasilla
        etiqueta={`Confirmo que quiero dar de baja al animal ${textoDiio(animal.diio)}`}
        checked={confirma}
        onChange={(e) => setConfirma(e.target.checked)}
      />
    </FormularioDialogo>
  )
}
