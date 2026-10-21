import { describe, expect, it } from 'vitest'
import { diasParaVencer, estadoStock, estadoVencimiento, fechaISOMasDias } from './vencimiento'

const hoy = new Date(2026, 9, 21) // 21-oct-2026

describe('diasParaVencer', () => {
  it('cuenta días enteros', () => {
    expect(diasParaVencer('2026-10-21', hoy)).toBe(0)
    expect(diasParaVencer('2026-10-22', hoy)).toBe(1)
    expect(diasParaVencer('2026-10-20', hoy)).toBe(-1)
    expect(diasParaVencer('2026-12-20', hoy)).toBe(60)
  })
  it('devuelve null con fecha ausente o inválida', () => {
    expect(diasParaVencer(null, hoy)).toBeNull()
    expect(diasParaVencer('no-fecha', hoy)).toBeNull()
  })
  it('acepta timestamps ISO', () => {
    expect(diasParaVencer('2026-10-25T00:00:00Z', hoy)).toBe(4)
  })
})

describe('estadoVencimiento', () => {
  it('clasifica vencido / próximo / vigente', () => {
    expect(estadoVencimiento('2026-10-20', hoy)).toBe('vencido')
    expect(estadoVencimiento('2026-10-21', hoy)).toBe('proximo')
    expect(estadoVencimiento('2026-12-20', hoy)).toBe('proximo')
    expect(estadoVencimiento('2026-12-21', hoy)).toBe('vigente')
    expect(estadoVencimiento(null, hoy)).toBe('sin_fecha')
  })
})

describe('estadoStock', () => {
  it('bajo solo si es estrictamente menor al mínimo', () => {
    expect(estadoStock(4, 5)).toBe('bajo')
    expect(estadoStock(5, 5)).toBe('ok')
    expect(estadoStock(0, 0)).toBe('ok')
  })
})

describe('fechaISOMasDias', () => {
  it('suma días cruzando mes', () => {
    expect(fechaISOMasDias(60, hoy)).toBe('2026-12-20')
    expect(fechaISOMasDias(0, hoy)).toBe('2026-10-21')
  })
})
