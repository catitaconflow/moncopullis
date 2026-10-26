import { useState } from 'react'
import { aNumero, CampoArea, CampoSelect, CampoTexto } from '../components/Campos'
import { FormularioDialogo } from '../components/FormularioDialogo'
import { ejecutar } from '../data/ejecutar'
import { listarProveedores } from '../data/consultas'
import type { Lote, Medicamento } from '../data/tipos'
import { useConsulta } from '../data/useConsulta'
import { formatoFecha } from '../lib/formato'
import { opcional, type PropsForm } from './base'

interface Props extends PropsForm {
  med: Medicamento
  lotes: Lote[]
  /** Solo un ADMIN puede asignar proveedor (y leer la lista). */
  conProveedor: boolean
}

function SelectorProveedor({ valor, onCambiar }: { valor: string; onCambiar: (v: string) => void }) {
  const q = useConsulta(listarProveedores, [])
  const activos = (q.datos ?? []).filter((p) => p.activo)
  const ayuda = q.estado === 'error' ? 'No se pudo cargar la lista de proveedores.' : undefined
  return (
    <CampoSelect etiqueta="Proveedor (opcional)" value={valor} onChange={(e) => onCambiar(e.target.value)} disabled={q.estado === 'cargando'} ayuda={ayuda}>
      <option value="">Sin proveedor</option>
      {activos.map((p) => (
        <option key={p.id} value={p.id}>{p.razon_social}</option>
      ))}
    </CampoSelect>
  )
}

export function FormEntrada({ med, lotes, conProveedor, onCerrar, alExito }: Props) {
  const existentes = lotes.filter((l) => l.activo)
  const [loteId, setLoteId] = useState('')
  const [numero, setNumero] = useState('')
  const [vence, setVence] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [obs, setObs] = useState('')

  function elegirLote(id: string) {
    setLoteId(id)
    const l = existentes.find((x) => String(x.id) === id)
    setNumero(l?.numero_lote ?? '')
    setVence(l?.fecha_vencimiento ?? '')
  }

  function validar(): string | null {
    if (!numero.trim()) return 'El número de lote es obligatorio.'
    if (!vence) return 'La fecha de vencimiento es obligatoria.'
    if (!(aNumero(cantidad) > 0)) return 'La cantidad debe ser mayor que 0.'
    return null
  }

  const enviar = () =>
    ejecutar('fn_registrar_entrada', {
      p_medicamento_id: med.id,
      p_numero_lote: numero.trim(),
      p_fecha_vencimiento: vence,
      p_cantidad: aNumero(cantidad),
      p_proveedor_id: proveedor ? Number(proveedor) : null,
      p_observaciones: opcional(obs),
    })

  return (
    <FormularioDialogo
      titulo={`Registrar entrada de ${med.nombre_comercial}`}
      textoEnviar="Registrar entrada"
      exito="Entrada registrada."
      validar={validar}
      enviar={enviar}
      alExito={alExito}
      onCerrar={onCerrar}
    >
      <CampoSelect etiqueta="Lote" value={loteId} onChange={(e) => elegirLote(e.target.value)}>
        <option value="">Lote nuevo</option>
        {existentes.map((l) => (
          <option key={l.id} value={l.id}>{l.numero_lote} (vence {formatoFecha(l.fecha_vencimiento)})</option>
        ))}
      </CampoSelect>
      <CampoTexto etiqueta="Número de lote" value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={40} readOnly={loteId !== ''} />
      <CampoTexto etiqueta="Fecha de vencimiento" type="date" value={vence} onChange={(e) => setVence(e.target.value)} readOnly={loteId !== ''} />
      <CampoTexto etiqueta={`Cantidad (${med.unidad_base})`} type="number" inputMode="decimal" step="0.01" min="0.01" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
      {conProveedor && <SelectorProveedor valor={proveedor} onCambiar={setProveedor} />}
      <CampoArea etiqueta="Observaciones (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={300} />
    </FormularioDialogo>
  )
}
