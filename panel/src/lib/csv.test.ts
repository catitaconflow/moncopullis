import { describe, expect, it } from 'vitest'
import { columnasDe, escaparCelda, generarCsv } from './csv'

describe('escaparCelda', () => {
  it('deja pasar texto simple y vacía null', () => {
    expect(escaparCelda('hola')).toBe('hola')
    expect(escaparCelda(null)).toBe('')
    expect(escaparCelda(undefined)).toBe('')
  })

  it('entrecomilla separador, comillas y saltos de línea', () => {
    expect(escaparCelda('a;b')).toBe('"a;b"')
    expect(escaparCelda('dijo "hola"')).toBe('"dijo ""hola"""')
    expect(escaparCelda('a\nb')).toBe('"a\nb"')
  })

  it('neutraliza fórmulas pero no números negativos', () => {
    expect(escaparCelda('=SUMA(A1)')).toBe("'=SUMA(A1)")
    expect(escaparCelda('+1')).toBe("'+1")
    expect(escaparCelda('-1+2')).toBe("'-1+2")
    expect(escaparCelda('@cmd')).toBe("'@cmd")
    expect(escaparCelda(-5)).toBe('-5')
  })

  it('serializa objetos como JSON', () => {
    expect(escaparCelda({ a: 1 })).toBe('"{""a"":1}"')
  })
})

describe('generarCsv', () => {
  it('genera BOM, encabezado, CRLF y une columnas de todas las filas', () => {
    const filas = [{ a: 1, b: 'x' }, { a: 2, c: '=1' }]
    expect(columnasDe(filas)).toEqual(['a', 'b', 'c'])
    expect(generarCsv(filas)).toBe("\uFEFFa;b;c\r\n1;x;\r\n2;;'=1\r\n")
  })

  it('con cero filas deja solo el encabezado indicado', () => {
    expect(generarCsv([], ['id', 'nombre'])).toBe('\uFEFFid;nombre\r\n')
  })
})
