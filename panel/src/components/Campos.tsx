import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import type { Mapa } from '../lib/etiquetas'

interface Comun {
  etiqueta: string
  ayuda?: string
}

function Ayuda({ id, texto }: { id: string; texto?: string }) {
  return texto ? <p id={id} className="campo-ayuda">{texto}</p> : null
}

export function CampoTexto({ etiqueta, ayuda, ...resto }: Comun & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>) {
  const id = useId()
  return (
    <>
      <label htmlFor={id}>{etiqueta}</label>
      <input id={id} aria-describedby={ayuda ? `${id}-a` : undefined} {...resto} />
      <Ayuda id={`${id}-a`} texto={ayuda} />
    </>
  )
}

export function CampoSelect({
  etiqueta, ayuda, children, ...resto
}: Comun & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & { children: ReactNode }) {
  const id = useId()
  return (
    <>
      <label htmlFor={id}>{etiqueta}</label>
      <select id={id} aria-describedby={ayuda ? `${id}-a` : undefined} {...resto}>
        {children}
      </select>
      <Ayuda id={`${id}-a`} texto={ayuda} />
    </>
  )
}

export function CampoArea({ etiqueta, ayuda, ...resto }: Comun & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>) {
  const id = useId()
  return (
    <>
      <label htmlFor={id}>{etiqueta}</label>
      <textarea id={id} rows={3} aria-describedby={ayuda ? `${id}-a` : undefined} {...resto} />
      <Ayuda id={`${id}-a`} texto={ayuda} />
    </>
  )
}

export function CampoCasilla({ etiqueta, ...resto }: { etiqueta: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'>) {
  const id = useId()
  return (
    <div className="casilla">
      <input id={id} type="checkbox" {...resto} />
      <label htmlFor={id}>{etiqueta}</label>
    </div>
  )
}

export function Opciones({ mapa }: { mapa: Mapa }) {
  return (
    <>
      {Object.entries(mapa).map(([k, v]) => (
        <option key={k} value={k}>{v}</option>
      ))}
    </>
  )
}

/** Convierte el texto de un input numérico a número (NaN si está vacío o es inválido). */
export function aNumero(valor: string): number {
  return valor.trim() === '' ? Number.NaN : Number(valor.replace(',', '.'))
}
