package cl.moncopulli.app.ui.navegacion

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cl.moncopulli.app.data.envio.EnviosRepository
import cl.moncopulli.app.data.red.MonitorConexion
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn

/** Estado global de la barra superior (chip) y de la inferior (insignia de Actividad). */
@HiltViewModel
class PrincipalViewModel @Inject constructor(
    monitor: MonitorConexion,
    envios: EnviosRepository,
) : ViewModel() {
    val enLinea: StateFlow<Boolean> = monitor.enLinea
    val pendientes: StateFlow<Int> =
        envios.cantidadPendientes.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)
    val rechazados: StateFlow<Int> =
        envios.cantidadRechazados.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)
}
