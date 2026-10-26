import { describe, expect, it } from 'vitest'
import { aValorLocal, generarRepeticiones, localAISO } from './dosis'

describe('generarRepeticiones', () => {
  const inicio = new Date(2026, 9, 27, 9, 0)

  it('genera filas separadas por N horas, incluida la primera', () => {
    const r = generarRepeticiones(inicio, 12, 3)
    expect(r.map(aValorLocal)).toEqual(['2026-10-27T09:00', '2026-10-27T21:00', '2026-10-28T09:00'])
  })

  it('rechaza datos inválidos', () => {
    expect(generarRepeticiones(inicio, 0, 3)).toEqual([])
    expect(generarRepeticiones(inicio, 8, 0)).toEqual([])
    expect(generarRepeticiones(inicio, 8, 61)).toEqual([])
    expect(generarRepeticiones(inicio, 8, 2.5)).toEqual([])
    expect(generarRepeticiones(new Date('x'), 8, 2)).toEqual([])
  })
})

describe('fechas locales', () => {
  it('ida y vuelta del datetime-local', () => {
    const iso = localAISO('2026-10-27T09:30')
    expect(iso).not.toBeNull()
    expect(aValorLocal(new Date(iso as string))).toBe('2026-10-27T09:30')
    expect(localAISO('')).toBeNull()
    expect(localAISO('basura')).toBeNull()
  })
})
