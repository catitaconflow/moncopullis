package cl.moncopulli.app.data.envio

import io.github.jan.supabase.exceptions.RestException
import io.github.jan.supabase.postgrest.exception.PostgrestRestException

/** Qué hacer cuando falla un envío. */
sealed interface FalloEnvio {
    /** Sin respuesta HTTP: no sabemos si llegó. Se reintenta (las RPC del outbox son idempotentes). */
    data object SinRespuesta : FalloEnvio

    /** 401: el token venció y no se pudo renovar. Se deja pendiente hasta que la app renueve la sesión. */
    data object SesionVencida : FalloEnvio

    /** El servidor respondió pero el problema es pasajero (5xx, 408, 429): se reintenta. */
    data class Transitorio(val status: Int) : FalloEnvio

    /** Respuesta definitiva (P0001, 42501, 23514…): reintentar daría lo mismo. */
    data class Rechazo(val mensaje: String) : FalloEnvio
}

fun clasificarFallo(e: Exception): FalloEnvio {
    // supabase-kt: HttpRequestException (red) no es RestException; cualquier otra cosa sin respuesta
    // (timeout, error al leer la respuesta) también se trata como "no sabemos si llegó".
    if (e !is RestException) return FalloEnvio.SinRespuesta
    val status = e.response.status.value
    return when {
        status == 401 -> FalloEnvio.SesionVencida
        status >= 500 || status == 408 || status == 429 -> FalloEnvio.Transitorio(status)
        e is PostgrestRestException && e.code == "P0001" -> FalloEnvio.Rechazo(e.error) // mensaje de fn_error, tal cual
        e is PostgrestRestException && e.code == "42501" -> FalloEnvio.Rechazo("No tienes permiso para esta acción.")
        else -> {
            val codigo = (e as? PostgrestRestException)?.code?.let { ", código $it" } ?: ""
            FalloEnvio.Rechazo("El servidor rechazó el envío (error $status$codigo).")
        }
    }
}
