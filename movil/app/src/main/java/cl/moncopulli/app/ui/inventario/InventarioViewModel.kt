package cl.moncopulli.app.ui.inventario

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cl.moncopulli.app.data.ZONA_CHILE
import cl.moncopulli.app.data.inventario.InventarioRepository
import cl.moncopulli.app.data.inventario.MedicamentoStock
import cl.moncopulli.app.ui.comun.LOCALE_CHILE
import cl.moncopulli.app.ui.comun.mensajeDeLectura
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class InventarioUi(
    val cargando: Boolean = true,
    val actualizando: Boolean = false,
    val medicamentos: List<MedicamentoStock> = emptyList(),
    val error: String? = null,
    val busqueda: String = "",
    val soloBajoMinimo: Boolean = false,
    val hoy: LocalDate = LocalDate.now(ZONA_CHILE),   // día de la última carga
) {
    val totalBajoMinimo: Int get() = medicamentos.count { it.bajoMinimo }

    val visibles: List<MedicamentoStock>
        get() {
            val q = busqueda.trim().lowercase(LOCALE_CHILE)
            return medicamentos.filter { m ->
                (!soloBajoMinimo || m.bajoMinimo) &&
                        (q.isEmpty() ||
                                m.nombre.lowercase(LOCALE_CHILE).contains(q) ||
                                m.principioActivo?.lowercase(LOCALE_CHILE)?.contains(q) == true)
            }
        }
}

@HiltViewModel
class InventarioViewModel @Inject constructor(
    private val repo: InventarioRepository,
) : ViewModel() {

    private val _ui = MutableStateFlow(InventarioUi())
    val ui: StateFlow<InventarioUi> = _ui.asStateFlow()

    private var carga: Job? = null

    init {
        cargar(deslizando = false)
    }

    fun actualizar() = cargar(deslizando = true)

    fun buscar(texto: String) {
        _ui.update { it.copy(busqueda = texto) }
    }

    fun alternarBajoMinimo() {
        _ui.update { it.copy(soloBajoMinimo = !it.soloBajoMinimo) }
    }

    private fun cargar(deslizando: Boolean) {
        if (carga?.isActive == true) return
        _ui.update { it.copy(actualizando = deslizando, cargando = !deslizando && it.medicamentos.isEmpty()) }
        carga = viewModelScope.launch {
            try {
                val lista = repo.listar()
                _ui.update {
                    it.copy(
                        cargando = false, actualizando = false, error = null,
                        medicamentos = lista, hoy = LocalDate.now(ZONA_CHILE),
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