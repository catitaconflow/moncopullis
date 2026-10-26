import { describe, expect, it } from 'vitest'
import type { Alerta } from '../data/tipos'
import { cantidadConSigno, etiqueta, referenciaAlerta, textoResguardo, TIPOS_ALERTA } from './etiquetas'

const base: Alerta = {
  id: 1, tipo: 'STOCK_BAJO', estado: 'ABIERTA', fecha_creacion: '2026-10-01T00:00:00Z',
  fecha_resolucion: null, comentario: null, medicamento: null, lote: null, dosis: null,
}

describe('etiquetas', () => {
  it('traduce y deja pasar códigos desconocidos', () => {
    expect(etiqueta(TIPOS_ALERTA, 'STOCK_BAJO')).toBe('Stock bajo')
    expect(etiqueta(TIPOS_ALERTA, 'NUEVO')).toBe('NUEVO')
    expect(etiqueta(TIPOS_ALERTA, null)).toBe('—')
  })

  it('pone signo según el tipo de movimiento', () => {
    expect(cantidadConSigno('ENTRADA', 5)).toBe(5)
    expect(cantidadConSigno('REVERSA_DOSIS', 5)).toBe(5)
    expect(cantidadConSigno('ENTRADA_AJUSTE', 5)).toBe(5)
    expect(cantidadConSigno('SALIDA_DOSIS', 5)).toBe(-5)
    expect(cantidadConSigno('SALIDA_AJUSTE', 5)).toBe(-5)
  })

  it('describe a qué se refiere la alerta', () => {
    expect(referenciaAlerta({ ...base, medicamento: { nombre_comercial: 'Ivomec' } })).toBe('Ivomec')
    expect(referenciaAlerta({ ...base, lote: { numero_lote: 'L1', medicamento: { nombre_comercial: 'Ivomec' } } })).toBe('Ivomec, lote L1')
    const dosis = { medicamento: { nombre_comercial: 'Ivomec' }, tratamiento: { animal: { diio: '123456789' } } }
    expect(referenciaAlerta({ ...base, dosis })).toBe('Ivomec, animal 123456789')
    expect(referenciaAlerta(base)).toBe('—')
  })

  it('muestra el resguardo solo mientras está vigente', () => {
    const ahora = new Date(2026, 9, 26, 12, 0)
    expect(textoResguardo(new Date(2026, 9, 28, 9, 5).toISOString(), ahora)).toBe('No entregar leche hasta 28-10 09:05')
    expect(textoResguardo(new Date(2026, 9, 25, 9, 5).toISOString(), ahora)).toBeNull()
    expect(textoResguardo(null, ahora)).toBeNull()
  })
})
