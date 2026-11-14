package cl.moncopulli.app.ui.actividad

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cl.moncopulli.app.data.envio.EstadoEnvio
import cl.moncopulli.app.data.envio.Envio
import cl.moncopulli.app.data.envio.EnviosRepository
import cl.moncopulli.app.data.red.MonitorConexion
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class ActividadUi(
    val cargando: Boolean = true,
    val rechazados: List<Envio> = emptyList(),
    val pendientes: List<Envio> = emptyList(),   // en el orden en que se enviarán
    val enviados: List<Envio> = emptyList(),     // los más recientes primero
    val enLinea: Boolean = true,
) {
    val vacio: Boolean get() = !cargando && rechazados.isEmpty() && pendientes.isEmpty() && enviados.isEmpty()
}

@HiltViewModel
class ActividadViewModel @Inject constructor(
    private val envios: EnviosRepository,
    monitor: MonitorConexion,
) : ViewModel() {

    // Room avisa cada cambio de la tabla: la pantalla se actualiza sola cuando el worker envía.
    val ui: StateFlow<ActividadUi> = combine(envios.actividad, monitor.enLinea) { lista, enLinea ->
        ActividadUi(
            cargando = false,
            rechazados = lista.filter { it.estado == EstadoEnvio.RECHAZADO },
            pendientes = lista.filter { it.estado == EstadoEnvio.PENDIENTE }.sortedBy { it.guardadoEn },
            enviados = lista.filter { it.estado == EstadoEnvio.ENVIADO },
            enLinea = enLinea,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ActividadUi())

    init {
        viewModelScope.launch { envios.limpiarEnviadosAntiguos() }
    }

    fun enviarAhora() = envios.enviarAhora()

    fun volverAEnviar(id: String) {
        viewModelScope.launch { envios.volverAEnviar(id) }
    }

    fun descartar(id: String) {
        viewModelScope.launch { envios.descartar(id) }
    }
}
