import { describe, expect, it } from 'vitest'
import type { Animal, Medicamento, Tratamiento } from '../data/tipos'
import { filtrarAnimales } from './Animales'
import { filtrarMedicamentos } from './Inventario'
import { filtrarTratamientos } from './Tratamientos'

const med = (id: number, nombre: string, actual: number, minimo: number): Medicamento => ({
  id, nombre_comercial: nombre, principio_activo: 'oxitetraciclina', unidad_base: 'ml',
  stock_actual: actual, stock_minimo: minimo, activo: true,
})
const animal = (id: number, diio: string, baja: string | null): Animal => ({
  id, diio, categoria: 'Vaca', estado_productivo: null, fecha_baja: baja,
})
const trat = (id: number, diio: string, anulado: boolean): Tratamiento => ({
  id, animal_id: id, motivo: 'Mastitis', fecha_creacion: '2026-10-01T10:00:00Z',
  fecha_anulacion: anulado ? '2026-10-02T10:00:00Z' : null, animal: { diio },
})

describe('filtros rápidos', () => {
  const meds = [med(1, 'Terramicina', 2, 5), med(2, 'Ivomec', 10, 5)]

  it('Inventario separa bajo mínimo y OK, y busca por nombre o principio activo', () => {
    expect(filtrarMedicamentos(meds, 'bajo', '').map((m) => m.id)).toEqual([1])
    expect(filtrarMedicamentos(meds, 'ok', '').map((m) => m.id)).toEqual([2])
    expect(filtrarMedicamentos(meds, 'todos', 'ivo').map((m) => m.id)).toEqual([2])
    expect(filtrarMedicamentos(meds, 'todos', 'OXITETRA')).toHaveLength(2)
  })

  it('Animales distingue activos y de baja combinando con la búsqueda', () => {
    const lista = [animal(1, '0001 ', null), animal(2, '0002', '2026-01-01')]
    expect(filtrarAnimales(lista, '', 'activos').map((a) => a.id)).toEqual([1])
    expect(filtrarAnimales(lista, '', 'baja').map((a) => a.id)).toEqual([2])
    expect(filtrarAnimales(lista, '0002', 'activos')).toEqual([])
    expect(filtrarAnimales(lista, '')).toHaveLength(2)
  })

  it('Tratamientos distingue vigentes y anulados', () => {
    const lista = [trat(1, '0001', false), trat(2, '0002', true)]
    expect(filtrarTratamientos(lista, 'vigentes', '').map((t) => t.id)).toEqual([1])
    expect(filtrarTratamientos(lista, 'anulados', '').map((t) => t.id)).toEqual([2])
    expect(filtrarTratamientos(lista, 'todos', 'mastitis')).toHaveLength(2)
  })
})
