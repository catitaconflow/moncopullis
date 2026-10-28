// Revisa un archivo de importación en el navegador, antes de enviarlo.
// La base vuelve a validar todo (fn_importar_exportacion); esto solo da la vista previa y los errores a tiempo.

export const ENTIDADES = ['animal', 'medicamento', 'lote', 'tratamiento', 'dosis'] as const
export const MAX_REGISTROS = 5000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface Registro { uuid: string; entidad: string; datos: Record<string, unknown> }

export interface Revision {
  exportId: string
  registros: Registro[]
  porEntidad: Record<string, number>
  errores: string[]
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function revisarArchivo(texto: string): Revision {
  const vacia: Revision = { exportId: '', registros: [], porEntidad: {}, errores: [] }
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    return { ...vacia, errores: ['El archivo no es un JSON válido.'] }
  }
  if (!esObjeto(json)) return { ...vacia, errores: ['El archivo debe tener export_id y registros.'] }

  const exportId = typeof json.export_id === 'string' ? json.export_id.trim() : ''
  const errores: string[] = []
  if (!exportId) errores.push('Falta export_id: el identificador único de la exportación.')
  if (!Array.isArray(json.registros)) return { ...vacia, exportId, errores: [...errores, 'Falta la lista registros.'] }
  if (json.registros.length === 0) errores.push('El archivo no trae registros.')
  if (json.registros.length > MAX_REGISTROS) errores.push(`Trae ${json.registros.length} registros; el máximo es ${MAX_REGISTROS}.`)

  const vistos = new Set<string>()
  const porEntidad: Record<string, number> = {}
  json.registros.forEach((r: unknown, i: number) => {
    const n = i + 1
    if (!esObjeto(r)) return errores.push(`Registro ${n}: no es un objeto.`)
    const entidad = String(r.entidad ?? '')
    if (!(ENTIDADES as readonly string[]).includes(entidad)) errores.push(`Registro ${n}: la entidad «${entidad}» no se puede importar.`)
    else porEntidad[entidad] = (porEntidad[entidad] ?? 0) + 1
    const uuid = String(r.uuid ?? '')
    if (!UUID.test(uuid)) errores.push(`Registro ${n}: el uuid no es válido.`)
    else if (vistos.has(uuid.toLowerCase())) errores.push(`Registro ${n}: el uuid está repetido.`)
    else vistos.add(uuid.toLowerCase())
    if (!esObjeto(r.datos)) errores.push(`Registro ${n}: faltan los datos.`)
  })

  return { exportId, registros: json.registros as Registro[], porEntidad, errores }
}
