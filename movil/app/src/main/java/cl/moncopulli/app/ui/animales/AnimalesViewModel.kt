package cl.moncopulli.app.ui.animales

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cl.moncopulli.app.data.animal.AnimalRepository
import cl.moncopulli.app.data.animal.AnimalResumen
import cl.moncopulli.app.ui.comun.mensajeDeLectura
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.OffsetDateTime
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AnimalesUi(
    val cargando: Boolean = true,
    val actualizando: Boolean = false,
    val animales: List<AnimalResumen> = emptyList(),
    val error: String? = null,
    val busqueda: String = "",
    val soloResguardo: Boolean = false,
    val ahora: OffsetDateTime = OffsetDateTime.now(),   // momento de la última carga
) {
    fun enResguardo(a: AnimalResumen): Boolean = a.resguardoHasta?.isAfter(ahora) == true

    val totalEnResguardo: Int get() = animales.count(::enResguardo)

    val visibles: List<AnimalResumen>
        get() {
            val q = busqueda.trim()
            return animales.filter { a ->
                (!soloResguardo || enResguardo(a)) && (q.isEmpty() || a.diio?.contains(q) == true)
            }
        }
}

@HiltViewModel
class AnimalesViewModel @Inject constructor(
    private val repo: AnimalRepository,
) : ViewModel() {

    private val _ui = MutableStateFlow(AnimalesUi())
    val ui: StateFlow<AnimalesUi> = _ui.asStateFlow()

    private var carga: Job? = null

    init {
        cargar(deslizando = false)
    }

    fun actualizar() = cargar(deslizando = true)

    fun buscar(texto: String) {
        // DIIO: solo dígitos, máximo 9 (CHECK animal_diio_formato).
        _ui.update { it.copy(busqueda = texto.filter(Char::isDigit).take(9)) }
    }

    fun alternarResguardo() {
        _ui.update { it.copy(soloResguardo = !it.soloResguardo) }
    }

    private fun cargar(deslizando: Boolean) {
        if (carga?.isActive == true) return
        _ui.update { it.copy(actualizando = deslizando, cargando = !deslizando && it.animales.isEmpty()) }
        carga = viewModelScope.launch {
            try {
                val lista = repo.listarVivos()
                _ui.update {
                    it.copy(
                        cargando = false, actualizando = false, error = null,
                        animales = lista, ahora = OffsetDateTime.now(),
                    )
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _ui.update { it.copy(cargando = false, actualizando = false, error = mensajeDeLectura(e)) }
            }
        }
    }
}