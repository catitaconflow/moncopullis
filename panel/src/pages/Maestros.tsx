import { useState } from 'react'
import { useSesion } from '../auth/SesionProvider'
import { Insignia, Vista } from '../components/Estado'
import { Filtros } from '../components/Filtros'
import { Tabla, type Columna } from '../components/Tabla'
import { listarPropietarios, listarProveedores, listarUsuarios } from '../data/consultas'
import type { Propietario, Proveedor, Usuario } from '../data/tipos'
import { useConsulta } from '../data/useConsulta'
import { Dialogo } from '../components/Dialogo'
import { FormNuevoUsuario, FormPropietario, FormProveedor, FormUsuario } from '../formularios/FormMaestros'
import { etiqueta, ROLES } from '../lib/etiquetas'
import { esAdmin } from '../lib/permisos'

const estadoActivo = (activo: boolean) =>
  activo ? <Insignia tono="ok">Activo</Insignia> : <Insignia tono="neutro">Inactivo</Insignia>

function BotonEditar({ nombre, onClick }: { nombre: string; onClick: () => void }) {
  return (
    <button type="button" className="btn btn-chico" onClick={onClick} aria-label={`Editar ${nombre}`}>
      Editar
    </button>
  )
}

function Propietarios() {
  const q = useConsulta(listarPropietarios, [])
  const [edicion, setEdicion] = useState<Propietario | 'nuevo' | null>(null)
  const columnas: Columna<Propietario>[] = [
    { titulo: 'Nombre', render: (p) => p.nombre_completo },
    { titulo: 'RUT', render: (p) => p.rut },
    { titulo: 'Teléfono', render: (p) => p.telefono ?? '—' },
    { titulo: 'Estado', render: (p) => estadoActivo(p.activo) },
    { titulo: 'Acciones', render: (p) => <BotonEditar nombre={p.nombre_completo} onClick={() => setEdicion(p)} /> },
  ]
  return (
    <section aria-labelledby="t-prop">
      <div className="detalle-cabecera">
        <h2 id="t-prop">Propietarios</h2>
        <button type="button" className="btn btn-primario" onClick={() => setEdicion('nuevo')}>Nuevo propietario</button>
      </div>
      <Vista q={q} mensajeVacio="Aún no hay propietarios registrados.">
        {(filas) => <Tabla caption="Propietarios" columnas={columnas} filas={filas} clave={(p) => p.id} />}
      </Vista>
      {edicion && <FormPropietario propietario={edicion === 'nuevo' ? null : edicion} onCerrar={() => setEdicion(null)} alExito={q.recargar} />}
    </section>
  )
}

function Proveedores() {
  const q = useConsulta(listarProveedores, [])
  const [edicion, setEdicion] = useState<Proveedor | 'nuevo' | null>(null)
  const columnas: Columna<Proveedor>[] = [
    { titulo: 'Razón social', render: (p) => p.razon_social },
    { titulo: 'RUT', render: (p) => p.rut },
    { titulo: 'Contacto', render: (p) => p.nombre_contacto ?? '—' },
    { titulo: 'Teléfono', render: (p) => p.telefono ?? '—' },
    { titulo: 'Correo', render: (p) => p.email ?? '—' },
    { titulo: 'Estado', render: (p) => estadoActivo(p.activo) },
    { titulo: 'Acciones', render: (p) => <BotonEditar nombre={p.razon_social} onClick={() => setEdicion(p)} /> },
  ]
  return (
    <section aria-labelledby="t-prov">
      <div className="detalle-cabecera">
        <h2 id="t-prov">Proveedores</h2>
        <button type="button" className="btn btn-primario" onClick={() => setEdicion('nuevo')}>Nuevo proveedor</button>
      </div>
      <Vista q={q} mensajeVacio="Aún no hay proveedores registrados.">
        {(filas) => <Tabla caption="Proveedores" columnas={columnas} filas={filas} clave={(p) => p.id} />}
      </Vista>
      {edicion && <FormProveedor proveedor={edicion === 'nuevo' ? null : edicion} onCerrar={() => setEdicion(null)} alExito={q.recargar} />}
    </section>
  )
}

function ClaveTemporal({ email, clave, onCerrar }: { email: string; clave: string; onCerrar: () => void }) {
  const [copiada, setCopiada] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(clave)
      setCopiada(true)
    } catch {
      setCopiada(false)
    }
  }
  return (
    <Dialogo titulo="Contraseña temporal" onCerrar={onCerrar}>
      <p>Entrega esta contraseña a <strong>{email}</strong>. Al entrar por primera vez tendrá que cambiarla.</p>
      <p className="codigo-telegram clave-temporal">{clave}</p>
      <p className="advertencia advertencia-fuerte">No se volverá a mostrar. Cópiala antes de cerrar.</p>
      <div className="form-acciones">
        <button type="button" className="btn" onClick={() => void copiar()}>{copiada ? 'Copiada' : 'Copiar'}</button>
        <button type="button" className="btn btn-primario" onClick={onCerrar}>Listo</button>
      </div>
    </Dialogo>
  )
}

function Usuarios() {
  const q = useConsulta(listarUsuarios, [])
  const [edicion, setEdicion] = useState<Usuario | 'nuevo' | null>(null)
  const [creado, setCreado] = useState<{ email: string; clave: string } | null>(null)
  const columnas: Columna<Usuario>[] = [
    { titulo: 'Nombre', render: (u) => `${u.nombres} ${u.apellidos}` },
    { titulo: 'Correo', render: (u) => u.email },
    { titulo: 'Rol', render: (u) => etiqueta(ROLES, u.rol) },
    { titulo: 'Estado', render: (u) => estadoActivo(u.activo) },
    { titulo: 'Telegram', render: (u) => (u.telegram_user_id !== null ? 'Vinculado' : 'No vinculado') },
    { titulo: 'Acciones', render: (u) => <BotonEditar nombre={`${u.nombres} ${u.apellidos}`} onClick={() => setEdicion(u)} /> },
  ]
  return (
    <section aria-labelledby="t-usr">
      <div className="detalle-cabecera">
        <h2 id="t-usr">Usuarios</h2>
        <button type="button" className="btn btn-primario" onClick={() => setEdicion('nuevo')}>Nuevo usuario</button>
      </div>
      <Vista q={q} mensajeVacio="Aún no hay usuarios registrados.">
        {(filas) => <Tabla caption="Usuarios" columnas={columnas} filas={filas} clave={(u) => u.id} />}
      </Vista>
      {edicion === 'nuevo' && (
        <FormNuevoUsuario
          onCerrar={() => setEdicion(null)}
          alExito={q.recargar}
          alCrear={(email, clave) => setCreado({ email, clave })}
        />
      )}
      {edicion && edicion !== 'nuevo' && <FormUsuario usuario={edicion} onCerrar={() => setEdicion(null)} alExito={q.recargar} />}
      {creado && <ClaveTemporal email={creado.email} clave={creado.clave} onCerrar={() => setCreado(null)} />}
    </section>
  )
}

type Seccion = 'propietarios' | 'proveedores' | 'usuarios'

export function Maestros() {
  const { perfil } = useSesion()
  const admin = esAdmin(perfil?.rol)
  const [seccion, setSeccion] = useState<Seccion>('propietarios')
  const actual: Seccion = admin ? seccion : 'propietarios'
  return (
    <>
      <h1>Maestros</h1>
      {admin && (
        <div className="barra-herramientas">
          <Filtros
            etiqueta="Sección"
            valor={actual}
            onCambiar={setSeccion}
            opciones={[
              { clave: 'propietarios', texto: 'Propietarios' },
              { clave: 'proveedores', texto: 'Proveedores' },
              { clave: 'usuarios', texto: 'Usuarios' },
            ]}
          />
        </div>
      )}
      {actual === 'propietarios' && <Propietarios />}
      {actual === 'proveedores' && <Proveedores />}
      {actual === 'usuarios' && <Usuarios />}
    </>
  )
}
