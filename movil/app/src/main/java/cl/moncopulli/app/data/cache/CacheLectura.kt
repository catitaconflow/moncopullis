package cl.moncopulli.app.data.cache

import android.util.Log
import cl.moncopulli.app.data.ZONA_CHILE
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.exceptions.RestException
import java.time.Instant
import java.time.OffsetDateTime
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.Json

/** Datos leídos y, si vienen de la caché, cuándo se guardaron (null = recién llegados del servidor). */
data class Lectura<T>(val datos: T, val guardadoEn: OffsetDateTime? = null) {
    fun <R> map(f: (T) -> R): Lectura<R> = Lectura(f(datos), guardadoEn)
}

/** Mismo criterio para leer la red y la caché: columnas que la app no conoce se ignoran. */
internal val JSON_CACHE = Json { ignoreUnknownKeys = true }

@Singleton
class CacheLectura @Inject constructor(
    private val dao: CacheDao,
    private val supabase: SupabaseClient,
) {
    /**
     * Red primero, caché de respaldo:
     * - Si el servidor responde, se decodifica, se guarda y se devuelve.
     * - Si NO hay respuesta (sin red), se devuelve lo último guardado con su fecha.
     * - Si el servidor responde con error (401, 500…) se lanza: ocultarlo tras datos viejos
     *   escondería un problema real.
     * [red] devuelve el JSON crudo (PostgrestResult.data).
     */
    suspend fun <T> leer(clave: String, red: suspend () -> String, decodificar: (String) -> T): Lectura<T> {
        val json = try {
            // Sin sesión válida (token vencido y aún sin renovar) PostgREST respondería como anon y las
            // RLS devolverían listas VACÍAS sin error, que pisarían la caché buena. Se trata como sin red.
            check(supabase.auth.currentSessionOrNull() != null) { "Sesión sin renovar" }
            red()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            if (e is RestException) throw e
            val c = dao.leer(clave) ?: throw e
            Log.i(TAG, "Sin respuesta del servidor: '$clave' desde la caché")
            return Lectura(
                decodificar(c.json),
                Instant.ofEpochMilli(c.guardadoEn).atZone(ZONA_CHILE).toOffsetDateTime(),
            )
        }
        val datos = decodificar(json) // primero decodificar: no se guarda una respuesta que no se entiende
        dao.guardar(CacheEntity(clave, json, System.currentTimeMillis()))
        return Lectura(datos)
    }

    suspend fun borrarTodo() = dao.borrarTodo()

    private companion object {
        const val TAG = "MoncopulliCache"
    }
}
