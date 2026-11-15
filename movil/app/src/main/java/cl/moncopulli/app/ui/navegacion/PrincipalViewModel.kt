package cl.moncopulli.app.ui.navegacion

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cl.moncopulli.app.data.auth.SesionRepository
import cl.moncopulli.app.data.cache.PrecargaCache
import cl.moncopulli.app.data.envio.EnviosRepository
import cl.moncopulli.app.data.red.MonitorConexion
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jan.supabase.auth.status.SessionStatus
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Estado global de la barra superior (chip) y de la inferior (insignia de Actividad). */
@HiltViewModel
class PrincipalViewModel @Inject constructor(
    monitor: MonitorConexion,
    envios: EnviosRepository,
    sesion: SesionRepository,
    precarga: PrecargaCache,
) : ViewModel() {
    val enLinea: StateFlow<Boolean> = monitor.enLinea
    val pendientes: StateFlow<Int> =
        envios.cantidadPendientes.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)
    val rechazados: StateFlow<Int> =
        envios.cantidadRechazados.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    init {
        // Precarga cada vez que pasa a haber red Y sesión válida: al entrar, al volver la señal y al
        // renovarse una sesión vencida. collectLatest cancela una precarga en curso si se pierde la red
        // o se cierra sesión (para no guardar datos después de borrar la caché).
        viewModelScope.launch {
            combine(monitor.enLinea, sesion.estadoAuth) { red, s -> red && s is SessionStatus.Authenticated }
                .distinctUntilChanged()
                .collectLatest { listo -> if (listo) precarga.precargar() }
        }
    }
}
