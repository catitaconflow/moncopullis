import { useState } from 'react'
import { aNumero, CampoArea, CampoSelect, CampoTexto, Opciones } from '../components/Campos'
import { FormularioDialogo } from '../components/FormularioDialogo'
import { ejecutar } from '../data/ejecutar'
import type { Lote, Medicamento } from '../data/tipos'
import { MOTIVOS_AJUSTE, TIPOS_AJUSTE } from '../lib/etiquetas'
import { formatoNumero } from '../lib/formato'
import { opcional, type PropsForm } from './base'

interface Props extends PropsForm {
  med: Medicamento
  lote: Lote
}

export function FormAjuste({ med, lote, onCerrar, alExito }: Props) {
  const [tipo, setTipo] = useState('SALIDA_AJUSTE')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('CONTEO')
  const [obs, setObs] = useState('')

  function validar(): string | null {
    const n = aNumero(cantidad)
    if (!(n > 0)) return 'La cantidad debe ser mayor que 0.'
    if (tipo === 'SALIDA_AJUSTE' && n > lote.stock_lote) return `El lote tiene solo ${formatoNumero(lote.stock_lote)} ${med.unidad_base}.`
    if (motivo === 'OTRO' && !obs.trim()) return 'Con el motivo «Otro» explica el ajuste en observaciones.'
    return null
  }

  const enviar = () =>
    ejecutar('fn_registrar_ajuste', {
      p_lote_id: lote.id,
      p_tipo: tipo,
      p_cantidad: aNumero(cantidad),
      p_motivo: motivo,
      p_observaciones: opcional(obs),
    })

  return (
    <FormularioDialogo
      titulo={`Ajustar lote ${lote.numero_lote}`}
      textoEnviar="Registrar ajuste"
      exito="Ajuste registrado."
      validar={validar}
      enviar={enviar}
      alExito={alExito}
      onCerrar={onCerrar}
    >
      <p className="muted">
        {med.nombre_comercial}: el lote tiene {formatoNumero(lote.stock_lote)} {med.unidad_base}.
      </p>
      <CampoSelect etiqueta="Tipo de ajuste" value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <Opciones mapa={TIPOS_AJUSTE} />
      </CampoSelect>
      <CampoTexto etiqueta={`Cantidad (${med.unidad_base})`} type="number" inputMode="decimal" step="0.01" min="0.01" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
      <CampoSelect etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
        <Opciones mapa={MOTIVOS_AJUSTE} />
      </CampoSelect>
      <CampoArea etiqueta={motivo === 'OTRO' ? 'Observaciones (obligatorio)' : 'Observaciones (opcional)'} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={300} />
    </FormularioDialogo>
  )
}
