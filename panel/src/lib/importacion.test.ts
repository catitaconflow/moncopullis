import { describe, expect, it } from 'vitest'
import { revisarArchivo } from './importacion'

const U1 = '6f1c2d3e-4a5b-4c6d-8e7f-901234567890'
const U2 = '6f1c2d3e-4a5b-4c6d-8e7f-901234567891'
const archivo = (registros: unknown[], export_id: unknown = 'EXP-1') => JSON.stringify({ export_id, registros })

describe('revisarArchivo', () => {
  it('acepta un archivo válido y cuenta por entidad', () => {
    const r = revisarArchivo(archivo([
      { uuid: U1, entidad: 'animal', datos: { diio: '123456789' } },
      { uuid: U2, entidad: 'lote', datos: {} },
    ]))
    expect(r.errores).toEqual([])
    expect(r.exportId).toBe('EXP-1')
    expect(r.porEntidad).toEqual({ animal: 1, lote: 1 })
  })

  it('rechaza JSON roto o sin estructura', () => {
    expect(revisarArchivo('{no es json').errores[0]).toMatch(/no es un JSON/)
    expect(revisarArchivo('[]').errores[0]).toMatch(/export_id y registros/)
    expect(revisarArchivo(JSON.stringify({ export_id: 'X' })).errores).toContain('Falta la lista registros.')
  })

  it('informa cada error por número de registro', () => {
    const r = revisarArchivo(archivo([
      { uuid: 'malo', entidad: 'usuario', datos: [] },
      { uuid: U1, entidad: 'animal', datos: {} },
      { uuid: U1.toUpperCase(), entidad: 'animal', datos: {} },
    ], ''))
    expect(r.errores).toEqual([
      'Falta export_id: el identificador único de la exportación.',
      'Registro 1: la entidad «usuario» no se puede importar.',
      'Registro 1: el uuid no es válido.',
      'Registro 1: faltan los datos.',
      'Registro 3: el uuid está repetido.',
    ])
  })

  it('rechaza archivos vacíos', () => {
    expect(revisarArchivo(archivo([])).errores).toContain('El archivo no trae registros.')
  })
})
