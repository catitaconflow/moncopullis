export interface Medicamento {
  id: number
  nombre_comercial: string
  principio_activo: string | null
  tipo: string | null
  via_administracion: string | null
  unidad_base: string
  contenido_envase: number
  requiere_receta: boolean
  resguardo_leche_dias: number
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
  diio: string | null
  categoria: string | null
  estado_productivo: string | null
  fecha_baja: string | null
  motivo_baja: string | null
  propietario_id: number | null
  fecha_nacimiento: string | null
  madre_id: number | null
  origen_ingreso: string | null
  observaciones: string | null
}

export interface Tratamiento {
  id: number
  animal_id: number
  motivo: string | null
  indicado_por: string | null
  numero_receta: string | null
  observaciones: string | null
  fecha_creacion: string
  fecha_anulacion: string | null
  motivo_anulacion: string | null
  animal: { diio: string | null } | null
}

export interface Dosis {
  id: number
  tratamiento_id: number
  medicamento_id: number
  lote_id: number | null
  cantidad: number
  estado: string
  fecha_programada: string | null
  fecha_aplicada: string | null
  fin_resguardo_leche: string | null
  motivo_estado: string | null
  medicamento: { nombre_comercial: string; unidad_base: string } | null
  lote: { numero_lote: string } | null
}

export interface Movimiento {
  id: number
  lote_id: number
  tipo: string
  cantidad: number
  motivo: string | null
  observaciones: string | null
  fecha_evento: string
  usuario: { nombres: string; apellidos: string } | null
  lote: { numero_lote: string } | null
}

export interface Alerta {
  id: number
  tipo: string
  estado: string
  fecha_creacion: string
  fecha_resolucion: string | null
  comentario: string | null
  medicamento: { nombre_comercial: string } | null
  lote: { numero_lote: string; medicamento: { nombre_comercial: string } | null } | null
  dosis: {
    medicamento: { nombre_comercial: string } | null
    tratamiento: { animal: { diio: string | null } | null } | null
  } | null
}

export interface Propietario {
  id: number
  rut: string
  nombre_completo: string
  telefono: string | null
  activo: boolean
}

export interface Proveedor {
  id: number
  rut: string
  razon_social: string
  nombre_contacto: string | null
  telefono: string | null
  email: string | null
  activo: boolean
}

export interface Usuario {
  id: number
  nombres: string
  apellidos: string
  email: string
  rol: string
  activo: boolean
  telegram_user_id: number | null
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
