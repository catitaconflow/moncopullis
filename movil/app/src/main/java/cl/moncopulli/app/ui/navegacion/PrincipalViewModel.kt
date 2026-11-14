package cl.moncopulli.app.ui.navegacion

import androidx.lifecycle.ViewModel
import cl.moncopulli.app.data.red.MonitorConexion
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.StateFlow

/** Estado global de la barra superior e inferior. En el paso 4 suma el número de pendientes. */
@HiltViewModel
class PrincipalViewModel @Inject constructor(
    monitor: MonitorConexion,
) : ViewModel() {
    val enLinea: StateFlow<Boolean> = monitor.enLinea
}
