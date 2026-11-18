package cl.moncopulli.app.data.auth

import cl.moncopulli.app.data.cache.CacheDao
import cl.moncopulli.app.data.cache.CacheEntity
import cl.moncopulli.app.data.cache.JSON_CACHE
import cl.moncopulli.app.data.envio.EnvioDao
import cl.moncopulli.app.data.envio.ProgramadorEnvios
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.exceptions.RestException
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonPrimitive

/** Último perfil leído del servidor, con la cuenta de Auth a la que pertenece. */
@Serializable
data class PerfilGuardado(val authUserId: String, val perfil: Perfil)

/** Perfil y si vino del teléfono (sin conexión) en vez del servidor. */
data class PerfilLeido(val perfil: Perfil?, val sinConexion: Boolean)

@Singleton
class SesionRepository @Inject constructor(
    private val supabase: SupabaseClient,
    private val cacheDao: CacheDao,
    private val envioDao: EnvioDao,
    private val programador: ProgramadorEnvios,
) {
    val estadoAuth: Flow<SessionStatus> get() = supabase.auth.sessionStatus

    suspend fun iniciarSesion(correo: String, clave: String) {
        supabase.auth.signInWith(Email) {
            email = correo
            password = clave
        }
    }

    /**
     * Usuario de la sesión actual (guardada o recién iniciada), o null si no hay.
     * Ojo: supabase-kt solo entrega la sesión en estado Authenticated; con RefreshFailure (token vencido
     * y sin red) devuelve null aunque la sesión siga guardada.
     */
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
     * Si responde, se guarda en el teléfono; si no hay respuesta, se usa la guardada de esta cuenta.
     * Un error con respuesta (401, 500…) se lanza.
     */
    suspend fun leerPerfil(authUserId: String): PerfilLeido {
        val perfil = try {
            supabase.from("usuario")
                .select(columns = Columns.list("id", "nombres", "apellidos", "rol", "activo")) {
                    filter { eq("auth_user_id", authUserId) }
                }
                .decodeSingleOrNull<Perfil>()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            if (e is RestException) throw e
            val g = perfilGuardado()?.takeIf { it.authUserId == authUserId } ?: throw e
            return PerfilLeido(g.perfil, sinConexion = true)
        }
        if (perfil != null) {
            val json = JSON_CACHE.encodeToString(PerfilGuardado.serializer(), PerfilGuardado(authUserId, perfil))
            cacheDao.guardar(CacheEntity(CLAVE_PERFIL, json, System.currentTimeMillis()))
        }
        return PerfilLeido(perfil, sinConexion = false)
    }

    /** El último perfil autorizado en este teléfono (se borra al cerrar sesión). */
    suspend fun perfilGuardado(): PerfilGuardado? =
        cacheDao.leer(CLAVE_PERFIL)?.let {
            runCatching { JSON_CACHE.decodeFromString(PerfilGuardado.serializer(), it.json) }.getOrNull()
        }

    /** ¿Hay una sesión válida para hablar con el servidor? Sin ella, PostgREST respondería como anon. */
    fun haySesionValida(): Boolean = supabase.auth.currentSessionOrNull() != null

    /** Cuenta que firma una escritura: la de la sesión o, si no se pudo renovar sin red, la última autorizada. */
    suspend fun idUsuarioParaEscribir(): String? = usuarioActual()?.id ?: perfilGuardado()?.authUserId

    /**
     * Cierra sesión y borra todo lo de esta cuenta del teléfono: trabajos programados, outbox y caché.
     * Primero lo local: si el teléfono pasa a otra persona, nada de esta cuenta debe enviarse con la suya.
     * Quien llama debe haber confirmado con el usuario si había pendientes (se pierden).
     */
    suspend fun cerrarSesion() {
        programador.cancelar()
        envioDao.borrarTodo()
        cacheDao.borrarTodo()
        try {
            supabase.auth.signOut()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // Sin red el servidor no puede revocar el token, pero la sesión local se borra igual.
            supabase.auth.clearSession()
        }
    }

    private companion object {
        const val CLAVE_PERFIL = "perfil"
    }
}
