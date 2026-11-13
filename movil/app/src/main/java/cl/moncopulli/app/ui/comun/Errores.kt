package cl.moncopulli.app.ui.comun

import io.github.jan.supabase.exceptions.RestException
import io.github.jan.supabase.postgrest.exception.PostgrestRestException

/** Mensaje para errores de LECTURA (las RLS no fallan al leer: solo filtran filas). */
fun mensajeDeLectura(e: Exception): String = when (e) {
    is RestException -> when (e.response.status.value) {
        401 -> "Tu sesión expiró. Cierra sesión y vuelve a entrar."
        else -> "No se pudieron cargar los datos (error ${e.response.status.value})."
    }
    else -> "Sin conexión con el servidor. Desliza hacia abajo para reintentar."
}

private const val MSG_CONEXION = "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo."
private const val MSG_PERMISO = "No tienes permiso para esta acción."

/**
 * Mensaje para errores de ESCRITURA (RPC), con las mismas reglas que panel/src/data/ejecutar.ts:
 * P0001 = mensaje de fn_error para el usuario (tal cual), 42501 = sin permiso, resto = conexión.
 */
fun mensajeDeEscritura(e: Exception): String = when {
    e is PostgrestRestException && e.code == "P0001" -> e.error
    e is PostgrestRestException && e.code == "42501" -> MSG_PERMISO
    e is RestException && e.response.status.value == 401 -> "Tu sesión expiró. Cierra sesión y vuelve a entrar."
    else -> MSG_CONEXION
}
