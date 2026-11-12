package cl.moncopulli.app.ui.comun

import io.github.jan.supabase.exceptions.RestException

/** Mensaje para errores de LECTURA (las RLS no fallan al leer: solo filtran filas). */
fun mensajeDeLectura(e: Exception): String = when (e) {
    is RestException -> when (e.response.status.value) {
        401 -> "Tu sesión expiró. Cierra sesión y vuelve a entrar."
        else -> "No se pudieron cargar los datos (error ${e.response.status.value})."
    }
    else -> "Sin conexión con el servidor. Desliza hacia abajo para reintentar."
}