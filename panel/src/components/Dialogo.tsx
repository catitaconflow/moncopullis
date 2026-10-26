import { useEffect, useId, useRef, type ReactNode } from 'react'

interface DialogoProps {
  titulo: string
  onCerrar: () => void
  children: ReactNode
}

const PRIMER_CAMPO = 'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)'

/**
 * Modal con el elemento nativo <dialog>. Se monta solo cuando está abierto:
 * al desmontarse devuelve el foco al elemento que lo abrió.
 */
export function Dialogo({ titulo, onCerrar, children }: DialogoProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!dlg.open) dlg.showModal()
    dlg.querySelector<HTMLElement>(PRIMER_CAMPO)?.focus()
    return () => {
      if (dlg.open) dlg.close()
      previo?.focus()
    }
  }, [])

  return (
    // El evento close llega después de cerrar; si el diálogo ya se volvió a abrir
    // (React monta el efecto dos veces en desarrollo) no se debe cerrar.
    <dialog ref={ref} className="dialogo" aria-labelledby={idTitulo} onClose={() => !ref.current?.open && onCerrar()}>
      <h2 id={idTitulo} className="dialogo-titulo">{titulo}</h2>
      {children}
    </dialog>
  )
}
