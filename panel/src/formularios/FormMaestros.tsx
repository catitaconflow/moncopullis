import { useState } from 'react'
import { CampoCasilla, CampoSelect, CampoTexto, Opciones } from '../components/Campos'
import { FormularioDialogo } from '../components/FormularioDialogo'
import { ejecutar } from '../data/ejecutar'
import type { Propietario, Proveedor, Usuario } from '../data/tipos'
import { ROLES } from '../lib/etiquetas'
import { normalizarRut, validarRut } from '../lib/rut'
import { opcional, type PropsForm } from './base'

const AYUDA_RUT = 'Formato 12345678-9, sin puntos.'

export function FormPropietario({ propietario, onCerrar, alExito }: { propietario: Propietario | null } & PropsForm) {
  const [rut, setRut] = useState(propietario?.rut ?? '')
  const [nombre, setNombre] = useState(propietario?.nombre_completo ?? '')
  const [telefono, setTelefono] = useState(propietario?.telefono ?? '')
  const [activo, setActivo] = useState(propietario?.activo ?? true)

  function validar(): string | null {
    return validarRut(rut) ?? (nombre.trim() ? null : 'El nombre es obligatorio.')
  }

  return (
    <FormularioDialogo
      titulo={propietario ? 'Editar propietario' : 'Nuevo propietario'}
      exito={propietario ? 'Propietario actualizado.' : 'Propietario creado.'}
      validar={validar}
      enviar={() =>
        ejecutar('fn_guardar_propietario', {
          p_id: propietario?.id ?? null,
          p: { rut: normalizarRut(rut), nombre_completo: nombre.trim(), telefono: opcional(telefono), activo },
        })
      }
      alExito={alExito}
      onCerrar={onCerrar}
    >
      <CampoTexto etiqueta="RUT" value={rut} onChange={(e) => setRut(e.target.value)} maxLength={12} ayuda={AYUDA_RUT} />
      <CampoTexto etiqueta="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
      <CampoTexto etiqueta="Teléfono (opcional)" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={15} />
      {propietario && <CampoCasilla etiqueta="Activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />}
    </FormularioDialogo>
  )
}

export function FormProveedor({ proveedor, onCerrar, alExito }: { proveedor: Proveedor | null } & PropsForm) {
  const [rut, setRut] = useState(proveedor?.rut ?? '')
  const [razon, setRazon] = useState(proveedor?.razon_social ?? '')
  const [contacto, setContacto] = useState(proveedor?.nombre_contacto ?? '')
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? '')
  const [email, setEmail] = useState(proveedor?.email ?? '')
  const [activo, setActivo] = useState(proveedor?.activo ?? true)

  function validar(): string | null {
    const errRut = validarRut(rut)
    if (errRut) return errRut
    if (!razon.trim()) return 'La razón social es obligatoria.'
    return email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? 'El correo no es válido.' : null
  }

  return (
    <FormularioDialogo
      titulo={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}
      exito={proveedor ? 'Proveedor actualizado.' : 'Proveedor creado.'}
      validar={validar}
      enviar={() =>
        ejecutar('fn_guardar_proveedor', {
          p_id: proveedor?.id ?? null,
          p: {
            rut: normalizarRut(rut),
            razon_social: razon.trim(),
            nombre_contacto: opcional(contacto),
            telefono: opcional(telefono),
            email: opcional(email),
            activo,
          },
        })
      }
      alExito={alExito}
      onCerrar={onCerrar}
    >
      <CampoTexto etiqueta="RUT" value={rut} onChange={(e) => setRut(e.target.value)} maxLength={12} ayuda={AYUDA_RUT} />
      <CampoTexto etiqueta="Razón social" value={razon} onChange={(e) => setRazon(e.target.value)} maxLength={150} />
      <CampoTexto etiqueta="Nombre de contacto (opcional)" value={contacto} onChange={(e) => setContacto(e.target.value)} maxLength={120} />
      <CampoTexto etiqueta="Teléfono (opcional)" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={15} />
      <CampoTexto etiqueta="Correo (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
      {proveedor && <CampoCasilla etiqueta="Activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />}
    </FormularioDialogo>
  )
}

export function FormUsuario({ usuario, onCerrar, alExito }: { usuario: Usuario } & PropsForm) {
  const [rol, setRol] = useState(usuario.rol)
  const [activo, setActivo] = useState(usuario.activo)
  return (
    <FormularioDialogo
      titulo={`Editar a ${usuario.nombres} ${usuario.apellidos}`}
      exito="Usuario actualizado."
      enviar={() => ejecutar('fn_actualizar_usuario', { p_id: usuario.id, p_rol: rol, p_activo: activo })}
      alExito={alExito}
      onCerrar={onCerrar}
    >
      <p className="muted">{usuario.email}</p>
      <CampoSelect etiqueta="Rol" value={rol} onChange={(e) => setRol(e.target.value)}>
        <Opciones mapa={ROLES} />
      </CampoSelect>
      <CampoCasilla etiqueta="Activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
    </FormularioDialogo>
  )
}
