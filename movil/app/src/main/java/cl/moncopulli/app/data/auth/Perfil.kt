package cl.moncopulli.app.data.auth

import kotlinx.serialization.Serializable

/** Fila propia de la tabla usuario (solo las columnas que la app necesita). */
@Serializable
data class Perfil(
    val id: Long,
    val nombres: String,
    val apellidos: String,
    val rol: String,
    val activo: Boolean,
)

/** Roles que pueden usar la app: los mismos que aceptan fn_app_* (migración 0014). */
object Roles {
    const val ADMIN = "ADMIN"
    const val OPERARIO = "OPERARIO"
    val PERMITIDOS = setOf(ADMIN, OPERARIO)
}

/** Datos de la cuenta de Auth que importan para decidir si deja entrar. */
data class UsuarioAuth(
    val id: String,
    val debeCambiarClave: Boolean,
)