package cl.moncopulli.app.ui.inicio

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cl.moncopulli.app.data.dosis.DosisAplicada
import cl.moncopulli.app.data.dosis.DosisDelDia
import cl.moncopulli.app.data.dosis.DosisRepository
import cl.moncopulli.app.ui.comun.fechaHoraCortaChile
import cl.moncopulli.app.ui.comun.mensajeDeEscritura
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

enum class TipoAccion { APLICAR, OMITIR }

/** Diálogo abierto sobre una dosis. Vive en el ViewModel para sobrevivir a la rotación. */
data class AccionDosis(val dosis: DosisDelDia, val tipo: TipoAccion)

data class InicioUi(
    val cargando: Boolean = true,
    val actualizando: Boolean = false,
    val dosis: List<DosisDelDia> = emptyList(),
    val error: String? = null,
    val accion: AccionDosis? = null,
    val enviando: Boolean = false,
    val errorAccion: String? = null,   // se muestra dentro del diálogo
    val aviso: String? = null,         // se muestra una vez en un Snackbar
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
                val lista = repo.programadasHastaHoy()
                // copy (no InicioUi nuevo) para no perder el diálogo ni el aviso abiertos.
                _ui.update { it.copy(cargando = false, actualizando = false, dosis = lista, error = null) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Si ya había datos se conservan y se muestra el aviso arriba.
                _ui.update { it.copy(cargando = false, actualizando = false, error = mensajeDeLectura(e)) }
            }
        }
    }

    // --- Acciones sobre una dosis ---

    fun pedirAplicar(d: DosisDelDia) = abrir(AccionDosis(d, TipoAccion.APLICAR))
    fun pedirOmitir(d: DosisDelDia) = abrir(AccionDosis(d, TipoAccion.OMITIR))

    private fun abrir(a: AccionDosis) {
        if (_ui.value.enviando) return
        _ui.update { it.copy(accion = a, errorAccion = null) }
    }

    /** Cerrar el diálogo. Mientras se envía no se cierra: así no quedan dudas de si se guardó. */
    fun cancelarAccion() {
        val estado = _ui.value
        if (estado.enviando) return
        _ui.update { it.copy(accion = null, errorAccion = null) }
        // Si hubo un error (p. ej. "ya fue aplicada por otro usuario"), la lista puede estar desactualizada.
        if (estado.errorAccion != null) cargar(deslizando = false)
    }

    fun confirmarAplicar() {
        val a = _ui.value.accion?.takeIf { it.tipo == TipoAccion.APLICAR } ?: return
        enviar(a.dosis) { textoAplicada(repo.aplicar(a.dosis.id)) }
    }

    fun confirmarOmitir(motivo: String) {
        val a = _ui.value.accion?.takeIf { it.tipo == TipoAccion.OMITIR } ?: return
        if (motivo.isBlank()) {
            _ui.update { it.copy(errorAccion = "Indica por qué se omite la dosis.") }
            return
        }
        enviar(a.dosis) {
            repo.omitir(a.dosis.id, motivo)
            "Dosis omitida."
        }
    }

    fun avisoMostrado() = _ui.update { it.copy(aviso = null) }

    /** Ejecuta la RPC una sola vez a la vez; si sale bien quita la dosis de la lista y recarga. */
    private fun enviar(d: DosisDelDia, operacion: suspend () -> String) {
        if (_ui.value.enviando) return
        _ui.update { it.copy(enviando = true, errorAccion = null) }
        viewModelScope.launch {
            try {
                val aviso = operacion()
                _ui.update { u ->
                    u.copy(
                        enviando = false,
                        accion = null,
                        aviso = aviso,
                        dosis = u.dosis.filterNot { it.id == d.id },
                    )
                }
                cargar(deslizando = false)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "Falló la escritura de la dosis ${d.id}", e)
                _ui.update { it.copy(enviando = false, errorAccion = mensajeDeEscritura(e)) }
            }
        }
    }

    private fun textoAplicada(r: DosisAplicada): String {
        val base = if (r.yaRegistrada) "Esta dosis ya estaba aplicada por ti" else "Dosis aplicada"
        val lote = r.lote?.let { " (lote $it)" } ?: ""
        val resguardo = r.resguardoHasta?.let { " No entregar leche hasta ${fechaHoraCortaChile(it)}." } ?: ""
        return "$base$lote.$resguardo"
    }

    private companion object {
        const val TAG = "MoncopulliEscritura"
    }
}
