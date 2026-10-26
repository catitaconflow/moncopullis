import { describe, expect, it } from 'vitest'
import { generarArchivo, nombreArchivo, sha256Hex, tablasPara } from './exportar'

describe('tablasPara', () => {
  it('el auditor no ve alerta ni tablas maestras', () => {
    const nombres = tablasPara('AUDITOR').map((x) => x.tabla)
    expect(nombres).toEqual(['auditoria', 'auditoria_detalle', 'movimiento_inventario', 'tratamiento', 'dosis'])
  })

  it('el admin ve todo y usuario no incluye el hash de Telegram', () => {
    const admin = tablasPara('ADMIN')
    expect(admin.map((x) => x.tabla)).toContain('alerta')
    const usuario = admin.find((x) => x.tabla === 'usuario')
    expect(usuario?.columnas).not.toMatch(/codigo/)
  })

  it('el operario no exporta', () => {
    expect(tablasPara('OPERARIO')).toEqual([])
  })
})

describe('archivos', () => {
  it('genera JSON y CSV', () => {
    expect(JSON.parse(generarArchivo([{ a: 1 }], 'JSON'))).toEqual([{ a: 1 }])
    expect(generarArchivo([{ a: 1 }], 'CSV')).toContain('a\r\n1')
  })

  it('arma el nombre con sello de fecha', () => {
    expect(nombreArchivo('dosis', 'CSV', new Date(2026, 9, 5, 8, 7))).toBe('moncopulli-dosis-20261005-0807.csv')
  })

  it('calcula SHA-256 conocido', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
