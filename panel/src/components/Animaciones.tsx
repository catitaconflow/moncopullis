import { motion, useReducedMotion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

/** 8px de desplazamiento vertical, o 0 si el usuario prefiere menos movimiento. */
export function useDesplazamiento(): number {
  return useReducedMotion() ? 0 : 8
}

export function Pagina({ children }: { children: ReactNode }) {
  const y = useDesplazamiento()
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

/** Variantes para filas de lista: el retraso se limita para no demorar listas largas. */
export function useVariantesFila(): Variants {
  const y = useDesplazamiento()
  return {
    oculto: { opacity: 0, y },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.18, delay: Math.min(i, 10) * 0.025 },
    }),
  }
}
