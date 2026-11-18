package cl.moncopulli.app.data.red

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.stateIn

/**
 * ¿Hay internet ahora? Escucha la red por defecto del teléfono (la que usan las apps).
 * Se considera "en línea" solo si la red tiene INTERNET y además VALIDATED (Android comprobó que
 * sale a internet de verdad): un wifi sin salida o con portal cautivo cuenta como sin conexión.
 *
 * Es solo una pista para la interfaz (chip, desactivar Omitir). Que una escritura llegue o no se
 * decide por la respuesta real del servidor, nunca solo por este valor.
 */
@Singleton
class MonitorConexion @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val cm = context.getSystemService(ConnectivityManager::class.java)

    // Alcance propio: el monitor vive lo mismo que la app (es @Singleton).
    private val alcance = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val enLinea: StateFlow<Boolean> = callbackFlow {
        val callback = object : ConnectivityManager.NetworkCallback() {
            // Desde Android 8 (API 26) llega justo después de onAvailable y cada vez que cambia
            // la validación, así que basta con este y onLost.
            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                trySend(caps.tieneInternet())
            }

            override fun onLost(network: Network) {
                trySend(false)
            }
        }
        trySend(estadoActual())
        cm.registerDefaultNetworkCallback(callback)
        awaitClose { cm.unregisterNetworkCallback(callback) }
    }
        .distinctUntilChanged()
        // Escucha mientras alguna pantalla lo observe (+5 s para no re-registrar al rotar).
        .stateIn(alcance, SharingStarted.WhileSubscribed(5_000), estadoActual())

    fun estadoActual(): Boolean =
        cm.activeNetwork?.let(cm::getNetworkCapabilities)?.tieneInternet() == true
}

private fun NetworkCapabilities.tieneInternet(): Boolean =
    hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
