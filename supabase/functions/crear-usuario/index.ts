// Alta de usuarios desde el panel (solo ADMIN).
// Crea la cuenta en Auth con la clave de servicio y registra la fila en usuario con fn_crear_usuario,
// llamada con el JWT del ADMIN para que el permiso y la auditoría queden a su nombre.
// Si fn_crear_usuario rechaza el alta, se borra la cuenta recién creada.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'

const ORIGENES = new Set([
  'https://moncopulli-panel.itskay666.workers.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])
const ROLES = new Set(['ADMIN', 'OPERARIO', 'AUDITOR'])
const MAX_CUERPO = 4096
const ERROR_GENERAL = 'No se pudo crear el usuario. Inténtalo de nuevo.'

interface Alta {
  rut: string
  nombres: string
  apellidos: string
  email: string
  telefono: string | null
  rol: string
}

function cabeceras(origen: string | null): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  }
  if (origen && ORIGENES.has(origen)) {
    h['Access-Control-Allow-Origin'] = origen
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    h['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type'
  }
  return h
}

function responder(origen: string | null, estado: number, cuerpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras(origen) })
}

function digitoVerificador(cuerpo: string): string {
  let suma = 0
  let factor = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const r = 11 - (suma % 11)
  if (r === 11) return '0'
  return r === 10 ? 'K' : String(r)
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t && t.length <= max ? t : null
}

// Devuelve los datos limpios o el mensaje de error para el usuario.
function validar(b: Record<string, unknown>): Alta | string {
  const rut = typeof b.rut === 'string' ? b.rut.trim().replace(/\./g, '').toUpperCase() : ''
  const m = /^(\d{1,8})-([0-9K])$/.exec(rut)
  if (!m) return 'El RUT debe tener el formato 12345678-9.'
  if (digitoVerificador(m[1]) !== m[2]) return 'El dígito verificador del RUT no es correcto.'
  const nombres = texto(b.nombres, 80)
  if (!nombres) return 'Los nombres son obligatorios (hasta 80 caracteres).'
  const apellidos = texto(b.apellidos, 80)
  if (!apellidos) return 'Los apellidos son obligatorios (hasta 80 caracteres).'
  const email = texto(b.email, 254)?.toLowerCase()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'El correo no es válido.'
  let telefono: string | null = null
  if (b.telefono !== undefined && b.telefono !== null && b.telefono !== '') {
    telefono = texto(b.telefono, 15)
    if (!telefono) return 'El teléfono admite hasta 15 caracteres.'
  }
  const rol = typeof b.rol === 'string' ? b.rol : ''
  if (!ROLES.has(rol)) return 'Rol no válido.'
  return { rut, nombres, apellidos, email, telefono, rol }
}

// Sin caracteres que se confunden al dictar o copiar a mano (0/O, 1/l/I).
const GRUPOS = ['abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!#$%*+-=?@']
const LARGO_CLAVE = 14

// Índice uniforme en [0, n) descartando los valores que sesgarían el módulo.
function azar(n: number): number {
  const limite = Math.floor(0x100000000 / n) * n
  const buf = new Uint32Array(1)
  do {
    crypto.getRandomValues(buf)
  } while (buf[0] >= limite)
  return buf[0] % n
}

function claveTemporal(): string {
  const todos = GRUPOS.join('')
  const c = GRUPOS.map((g) => g[azar(g.length)])
  while (c.length < LARGO_CLAVE) c.push(todos[azar(todos.length)])
  for (let i = c.length - 1; i > 0; i--) {
    const j = azar(i + 1)
    ;[c[i], c[j]] = [c[j], c[i]]
  }
  return c.join('')
}

async function leerCuerpo(req: Request): Promise<Record<string, unknown> | null> {
  const t = await req.text()
  if (t.length > MAX_CUERPO) return null
  try {
    const b: unknown = JSON.parse(t)
    return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : null
  } catch {
    return null
  }
}

async function atender(req: Request): Promise<Response> {
  const origen = req.headers.get('Origin')
  if (origen && !ORIGENES.has(origen)) return responder(null, 403, { error: 'Origen no permitido.' })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabeceras(origen) })
  if (req.method !== 'POST') return responder(origen, 405, { error: 'Método no permitido.' })

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !servicio) return responder(origen, 500, { error: ERROR_GENERAL })

  const token = /^Bearer (\S+)$/.exec(req.headers.get('Authorization') ?? '')?.[1]
  if (!token) return responder(origen, 401, { error: 'Inicia sesión de nuevo.' })
  if (Number(req.headers.get('Content-Length') ?? 0) > MAX_CUERPO) {
    return responder(origen, 413, { error: 'La solicitud es demasiado grande.' })
  }

  const sinSesion = { persistSession: false, autoRefreshToken: false }
  const comoAdmin = createClient(url, anon, { auth: sinSesion, global: { headers: { Authorization: `Bearer ${token}` } } })
  const servicioCli = createClient(url, servicio, { auth: sinSesion })

  // Se revisa el rol antes de crear la cuenta; fn_crear_usuario lo vuelve a exigir.
  const { data: quien, error: errQuien } = await comoAdmin.auth.getUser(token)
  if (errQuien || !quien.user) return responder(origen, 401, { error: 'Inicia sesión de nuevo.' })
  const { data: perfil } = await comoAdmin.from('usuario').select('rol, activo').eq('auth_user_id', quien.user.id).maybeSingle()
  if (!perfil || perfil.rol !== 'ADMIN' || !perfil.activo) {
    return responder(origen, 403, { error: 'No tienes permiso para esta acción.' })
  }

  const cuerpo = await leerCuerpo(req)
  if (!cuerpo) return responder(origen, 400, { error: 'Datos no válidos.' })
  const alta = validar(cuerpo)
  if (typeof alta === 'string') return responder(origen, 400, { error: alta })

  const clave = claveTemporal()
  const { data: creado, error: errCrear } = await servicioCli.auth.admin.createUser({
    email: alta.email,
    password: clave,
    email_confirm: true,
    user_metadata: { debe_cambiar_clave: true },
  })
  if (errCrear || !creado.user) {
    const repetido = errCrear?.code === 'email_exists' || errCrear?.status === 422
    return repetido
      ? responder(origen, 409, { error: 'Ya existe una cuenta de acceso con ese correo.' })
      : responder(origen, 500, { error: ERROR_GENERAL })
  }

  const { data: id, error: errRpc } = await comoAdmin.rpc('fn_crear_usuario', {
    p_auth_user_id: creado.user.id,
    p_rut: alta.rut,
    p_nombres: alta.nombres,
    p_apellidos: alta.apellidos,
    p_email: alta.email,
    p_telefono: alta.telefono,
    p_rol: alta.rol,
  })
  if (errRpc) {
    const { error: errBorrar } = await servicioCli.auth.admin.deleteUser(creado.user.id)
    if (errBorrar) console.error('crear-usuario: no se pudo borrar la cuenta sin usuario', creado.user.id)
    if (errRpc.code === 'P0001') return responder(origen, 400, { error: errRpc.message })
    if (errRpc.code === '42501') return responder(origen, 403, { error: 'No tienes permiso para esta acción.' })
    return responder(origen, 500, { error: ERROR_GENERAL })
  }

  return responder(origen, 201, { id, email: alta.email, clave })
}

Deno.serve(async (req) => {
  try {
    return await atender(req)
  } catch {
    return responder(null, 500, { error: ERROR_GENERAL })
  }
})
