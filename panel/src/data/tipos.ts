export interface Medicamento {
  id: number
  nombre_comercial: string
  principio_activo: string | null
  unidad_base: string
  stock_actual: number
  stock_minimo: number
  activo: boolean
}

export interface Lote {
  id: number
  medicamento_id: number
  numero_lote: string
  fecha_vencimiento: string
  stock_lote: number
  activo: boolean
}

export interface Animal {
  id: number
  diio: string
  categoria: string | null
  estado_productivo: string | null
  fecha_baja: string | null
}

export interface Tratamiento {
  id: number
  animal_id: number
  motivo: string | null
  fecha_creacion: string
  fecha_anulacion: string | null
  animal: { diio: string } | null
}

export interface RegistroAuditoria {
  id: number
  fecha: string
  accion: string
  entidad: string
  origen: string | null
  usuario: { nombres: string; apellidos: string } | null
}

export interface PerfilUsuario {
  nombres: string
  apellidos: string
  rol: string
}
