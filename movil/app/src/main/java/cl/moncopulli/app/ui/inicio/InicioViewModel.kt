package cl.moncopulli.app.ui.inicio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cl.moncopulli.app.data.dosis.DosisDelDia
import cl.moncopulli.app.data.dosis.DosisRepository
import cl.moncopulli.app.ui.comun.mensajeDeLectura
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class InicioUi(
    val cargando: Boolean = true,
    val actualizando: Boolean = false,
    val dosis: List<DosisDelDia> = emptyList(),
    val error: String? = null,
)

@HiltViewModel
class InicioViewModel @Inject constructor(
    private val repo: DosisRepository,
) : ViewModel() {

    private val _ui = MutableStateFlow(InicioUi())
    val ui: StateFlow<InicioUi> = _ui.asStateFlow()

    private var carga: Job? = null

    init {
        cargar(deslizando = false)
    }

    fun actualizar() = cargar(deslizando = true)

    private fun cargar(deslizando: Boolean) {
        if (carga?.isActive == true) return
        _ui.update { it.copy(actualizando = deslizando, cargando = !deslizando && it.dosis.isEmpty()) }
        carga = viewModelScope.launch {
            try {
                _ui.value = InicioUi(cargando = false, dosis = repo.programadasHastaHoy())
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Si ya había datos se conservan y se muestra el aviso arriba.
                _ui.update { it.copy(cargando = false, actualizando = false, error = mensajeDeLectura(e)) }
            }
        }
    }
}