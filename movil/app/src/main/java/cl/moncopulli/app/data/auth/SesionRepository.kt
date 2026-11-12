package cl.moncopulli.app.data.auth

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonPrimitive

@Singleton
class SesionRepository @Inject constructor(
    private val supabase: SupabaseClient,
) {
    val estadoAuth: Flow<SessionStatus> get() = supabase.auth.sessionStatus

    suspend fun iniciarSesion(correo: String, clave: String) {
        supabase.auth.signInWith(Email) {
            email = correo
            password = clave
        }
    }

    /** Usuario de la sesión actual (guardada o recién iniciada), o null si no hay. */
    fun usuarioActual(): UsuarioAuth? =
        supabase.auth.currentSessionOrNull()?.user?.let { u ->
            UsuarioAuth(
                id = u.id,
                debeCambiarClave =
                    u.userMetadata?.get("debe_cambiar_clave")?.jsonPrimitive?.booleanOrNull == true,
            )
        }

    /**
     * Lee MI fila de usuario. El filtro por auth_user_id es obligatorio: un ADMIN puede leer
     * todas las filas (política lectura_usuario) y sin él habría más de una.
     */
    suspend fun leerPerfil(authUserId: String): Perfil? =
        supabase.from("usuario")
            .select(columns = Columns.list("id", "nombres", "apellidos", "rol", "activo")) {
                filter { eq("auth_user_id", authUserId) }
            }
            .decodeSingleOrNull<Perfil>()

    suspend fun cerrarSesion() {
        try {
            supabase.auth.signOut()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // Sin red el servidor no puede revocar el token, pero la sesión local se borra igual.
            supabase.auth.clearSession()
        }
    }
}