import { useState } from 'react'
import { aNumero, CampoCasilla, CampoSelect, CampoTexto, Opciones } from '../components/Campos'
import { FormularioDialogo } from '../components/FormularioDialogo'
import { ejecutar } from '../data/ejecutar'
import type { Medicamento } from '../data/tipos'
import { UNIDADES } from '../lib/etiquetas'
import { opcional, type PropsForm } from './base'

interface Props extends PropsForm {
  /** null = medicamento nuevo. */
  med: Medicamento | null
}

export function FormMedicamento({ med, onCerrar, alExito }: Props) {
  const [nombre, setNombre] = useState(med?.nombre_comercial ?? '')
  const [principio, setPrincipio] = useState(med?.principio_activo ?? '')
  const [tipo, setTipo] = useState(med?.tipo ?? '')
  const [via, setVia] = useState(med?.via_administracion ?? '')
  const [unidad, setUnidad] = useState(med?.unidad_base ?? 'ML')
  const [contenido, setContenido] = useState(med ? String(med.contenido_envase) : '')
  const [receta, setReceta] = useState(med?.requiere_receta ?? false)
  const [resguardo, setResguardo] = useState(String(med?.resguardo_leche_dias ?? 0))
  const [minimo, setMinimo] = useState(String(med?.stock_minimo ?? 0))
  const [activo, setActivo] = useState(med?.activo ?? true)

  function validar(): string | null {
    if (!nombre.trim()) return 'El nombre comercial es obligatorio.'
    if (!(aNumero(contenido) > 0)) return 'El contenido del envase debe ser mayor que 0.'
    const dias = aNumero(resguardo)
    if (!Number.isInteger(dias) || dias < 0 || dias > 365) return 'Los días de resguardo de leche deben estar entre 0 y 365.'
    if (!(aNumero(minimo) >= 0)) return 'El stock mínimo no puede ser negativo.'
    return null
  }

  const enviar = () =>
    ejecutar('fn_guardar_medicamento', {
      p_id: med?.id ?? null,
      p: {
        nombre_comercial: nombre.trim(),
        principio_activo: opcional(principio),
        tipo: opcional(tipo),
        via_administracion: opcional(via),
        unidad_base: unidad,
        contenido_envase: aNumero(contenido),
        requiere_receta: receta,
        resguardo_leche_dias: aNumero(resguardo),
        stock_minimo: aNumero(minimo),
        activo,
      },
    })

  return (
    <FormularioDialogo
      titulo={med ? `Editar ${med.nombre_comercial}` : 'Nuevo medicamento'}
      exito={med ? 'Medicamento actualizado.' : 'Medicamento creado.'}
      validar={validar}
      enviar={enviar}
      alExito={alExito}
      onCerrar={onCerrar}
    >
      <CampoTexto etiqueta="Nombre comercial" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} required />
      <CampoTexto etiqueta="Principio activo" value={principio} onChange={(e) => setPrincipio(e.target.value)} maxLength={120} />
      <CampoTexto etiqueta="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} maxLength={20} placeholder="Ej.: antibiótico" />
      <CampoTexto etiqueta="Vía de administración" value={via} onChange={(e) => setVia(e.target.value)} maxLength={15} placeholder="Ej.: intramuscular" />
      <CampoSelect etiqueta="Unidad base" value={unidad} onChange={(e) => setUnidad(e.target.value)}>
        <Opciones mapa={UNIDADES} />
      </CampoSelect>
      <CampoTexto etiqueta="Contenido del envase" type="number" inputMode="decimal" step="0.01" min="0.01" value={contenido} onChange={(e) => setContenido(e.target.value)} />
      <CampoTexto etiqueta="Resguardo de leche (días)" type="number" step="1" min="0" max="365" value={resguardo} onChange={(e) => setResguardo(e.target.value)} />
      <CampoTexto
        etiqueta="Stock mínimo"
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={minimo}
        onChange={(e) => setMinimo(e.target.value)}
        ayuda="El stock cambia solo con entradas, ajustes y dosis aplicadas."
      />
      <CampoCasilla etiqueta="Requiere receta" checked={receta} onChange={(e) => setReceta(e.target.checked)} />
      {med && <CampoCasilla etiqueta="Activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />}
    </FormularioDialogo>
  )
}
