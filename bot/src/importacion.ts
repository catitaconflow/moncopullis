// Importación de un export: valida todo antes de escribir y es idempotente por export_id.
// Si cualquier registro es inválido, no se escribe nada.

export interface RegistroExportado {
  uuid: string;
  entidad: string;
  datos: Record<string, unknown>;
}

export interface ExportacionEntrada {
  export_id: string;
  registros: unknown[];
}

export interface AlmacenImportacion {
  // Devuelve false si el export_id ya fue importado; si no, lo marca y guarda los registros.
  importarSiNuevo(exportId: string, registros: RegistroExportado[]): Promise<boolean>;
}

export type ResultadoImportacion =
  | { estado: 'importado'; cantidad: number }
  | { estado: 'ya_importado' }
  | { estado: 'invalido'; errores: string[] };

const ENTIDADES_PERMITIDAS = new Set(['animal', 'medicamento', 'lote', 'tratamiento', 'dosis']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validarRegistro(valor: unknown, posicion: number): string[] {
  if (typeof valor !== 'object' || valor === null) {
    return [`registro ${posicion}: no es un objeto`];
  }
  const r = valor as Partial<RegistroExportado>;
  const errores: string[] = [];
  if (typeof r.uuid !== 'string' || !UUID.test(r.uuid)) {
    errores.push(`registro ${posicion}: uuid inválido`);
  }
  if (typeof r.entidad !== 'string' || !ENTIDADES_PERMITIDAS.has(r.entidad)) {
    errores.push(`registro ${posicion}: entidad no permitida`);
  }
  if (typeof r.datos !== 'object' || r.datos === null || Array.isArray(r.datos)) {
    errores.push(`registro ${posicion}: datos debe ser un objeto`);
  }
  return errores;
}

export function validarExportacion(entrada: unknown): { errores: string[]; datos?: ExportacionEntrada & { registros: RegistroExportado[] } } {
  if (typeof entrada !== 'object' || entrada === null) {
    return { errores: ['el cuerpo no es un objeto'] };
  }
  const e = entrada as Partial<ExportacionEntrada>;
  if (typeof e.export_id !== 'string' || e.export_id.trim() === '') {
    return { errores: ['export_id obligatorio'] };
  }
  if (!Array.isArray(e.registros)) {
    return { errores: ['registros debe ser una lista'] };
  }
  const errores = e.registros.flatMap((r, i) => validarRegistro(r, i));
  if (errores.length > 0) return { errores };
  return {
    errores: [],
    datos: { export_id: e.export_id, registros: e.registros as RegistroExportado[] },
  };
}

export async function importarExportacion(
  entrada: unknown,
  almacen: AlmacenImportacion,
): Promise<ResultadoImportacion> {
  const { errores, datos } = validarExportacion(entrada);
  if (errores.length > 0 || !datos) return { estado: 'invalido', errores };

  const nuevo = await almacen.importarSiNuevo(datos.export_id, datos.registros);
  return nuevo
    ? { estado: 'importado', cantidad: datos.registros.length }
    : { estado: 'ya_importado' };
}
