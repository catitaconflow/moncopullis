import { useState } from 'react'
import { CampoArea } from '../components/Campos'
import { FormularioDialogo } from '../components/FormularioDialogo'
import { ejecutar } from '../data/ejecutar'
import type { PropsForm } from './base'

interface Props extends PropsForm {
  titulo: string
  etiqueta: string
  textoEnviar: string
  exito: string
  /** Nombre de la RPC y nombre del parámetro que recibe el texto. */
  rpc: string
  parametroTexto: string
  /** Resto de parámetros de la RPC (por ejemplo p_id). */
  params: Record<string, unknown>
  advertencia?: string
  peligro?: boolean
}

/** Formulario de un solo texto obligatorio: omitir dosis, anular tratamiento, resolver alerta. */
export function FormMotivo(p: Props) {
  const [texto, setTexto] = useState('')
  return (
    <FormularioDialogo
      titulo={p.titulo}
      textoEnviar={p.textoEnviar}
      exito={p.exito}
      peligro={p.peligro}
      validar={() => (texto.trim() ? null : `Escribe ${p.etiqueta.toLowerCase()}.`)}
      enviar={() => ejecutar(p.rpc, { ...p.params, [p.parametroTexto]: texto.trim() })}
      alExito={p.alExito}
      onCerrar={p.onCerrar}
    >
      {p.advertencia && <p className="advertencia">{p.advertencia}</p>}
      <CampoArea etiqueta={p.etiqueta} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300} />
    </FormularioDialogo>
  )
}
