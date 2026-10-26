/** Matriz de permisos de la interfaz. La autorización real la hace el servidor (RLS y funciones RPC). */
export const esAdmin = (rol: string | null | undefined): boolean => rol === 'ADMIN'
export const puedeOperar = (rol: string | null | undefined): boolean => rol === 'ADMIN' || rol === 'OPERARIO'
export const puedeAuditar = (rol: string | null | undefined): boolean => rol === 'ADMIN' || rol === 'AUDITOR'
