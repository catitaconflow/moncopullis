import { describe, expect, it } from 'vitest'
import { digitoVerificador, normalizarRut, validarRut } from './rut'

describe('RUT', () => {
  it('calcula el dígito verificador', () => {
    expect(digitoVerificador('12345678')).toBe('5')
    expect(digitoVerificador('11111111')).toBe('1')
    expect(digitoVerificador('6')).toBe('K')
    expect(digitoVerificador('22222222')).toBe('2')
    expect(digitoVerificador('1')).toBe('9')
  })

  it('normaliza puntos y minúsculas', () => {
    expect(normalizarRut(' 12.345.678-k ')).toBe('12345678-K')
  })

  it('acepta RUT válidos y rechaza dígito incorrecto o formato malo', () => {
    expect(validarRut('12345678-5')).toBeNull()
    expect(validarRut('12.345.678-5')).toBeNull()
    expect(validarRut('6-k')).toBeNull()
    expect(validarRut('12345678-9')).toMatch(/dígito verificador/)
    expect(validarRut('123456789')).toMatch(/formato/)
    expect(validarRut('')).toMatch(/formato/)
    expect(validarRut('123456789-1')).toMatch(/formato/)
  })
})
