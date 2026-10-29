import { generarCsv, type Fila } from './csv'

export const LIMITE_FILAS = 10_000

export type Formato = 'CSV' | 'JSON'

export interface TablaExportable {
  tabla: string
  texto: string
  /** Columnas a pedir; '*' salvo cuando hay campos que no deben salir de la base. */
  columnas: string
}

// En usuario no se exportan el hash ni los intentos del código de vinculación con Telegram.
const COLUMNAS_USUARIO =
  'id, auth_user_id, rut, nombres, apellidos, email, telefono, rol, activo, intentos_fallidos, bloqueado_hasta, telegram_user_id, fecha_creacion, ultimo_acceso'

const t = (tabla: string, texto: string, columnas = '*'): TablaExportable => ({ tabla, texto, columnas })

const CONSULTA: TablaExportable[] = [
  t('auditoria', 'Auditoría'),
  t('auditoria_detalle', 'Detalle de auditoría'),
  t('movimiento_inventario', 'Movimientos de inventario'),
  t('tratamiento', 'Tratamientos'),
  t('dosis', 'Dosis'),
]

const SOLO_ADMIN: TablaExportable[] = [
  t('animal', 'Animales'),
  t('medicamento', 'Medicamentos'),
  t('lote', 'Lotes'),
  t('alerta', 'Alertas'),
  t('propietario', 'Propietarios'),
  t('proveedor', 'Proveedores'),
  t('usuario', 'Usuarios', COLUMNAS_USUARIO),
  t('intercambio', 'Exportaciones e importaciones'),
  t('documento_veterinario', 'Documentos veterinarios'),
  t('mensaje_bot', 'Mensajes del bot'),
]

/** Tablas que el rol puede exportar (según las políticas de lectura). El auditor no lee alerta. */
export function tablasPara(rol: string | null | undefined): TablaExportable[] {
  if (rol === 'ADMIN') return [...CONSULTA, ...SOLO_ADMIN]
  return rol === 'AUDITOR' ? CONSULTA : []
}

export function generarArchivo(filas: Fila[], formato: Formato): string {
  return formato === 'CSV' ? generarCsv(filas) : JSON.stringify(filas, null, 2)
}

export function nombreArchivo(tabla: string, formato: Formato, ahora: Date = new Date()): string {
  const dos = (n: number): string => String(n).padStart(2, '0')
  const sello = `${ahora.getFullYear()}${dos(ahora.getMonth() + 1)}${dos(ahora.getDate())}-${dos(ahora.getHours())}${dos(ahora.getMinutes())}`
  return `moncopulli-${tabla}-${sello}.${formato.toLowerCase()}`
}

/** Huella SHA-256 (hexadecimal en minúsculas) del contenido codificado en UTF-8. */
export async function sha256Hex(contenido: string): Promise<string> {
  const bytes = new TextEncoder().encode(contenido)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function descargar(contenido: string, nombre: string, formato: Formato): void {
  const tipo = formato === 'CSV' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8'
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
