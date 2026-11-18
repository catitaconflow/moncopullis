package cl.moncopulli.app.ui.inicio

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cl.moncopulli.app.data.CambiosDatos
import cl.moncopulli.app.data.dosis.DosisAplicada
import cl.moncopulli.app.data.dosis.DosisDelDia
import cl.moncopulli.app.data.dosis.DosisRepository
import cl.moncopulli.app.data.envio.EnviosRepository
import cl.moncopulli.app.data.envio.ResultadoEnvio
import cl.moncopulli.app.data.red.MonitorConexion
import cl.moncopulli.app.ui.comun.avisoDeCache
import cl.moncopulli.app.ui.comun.cantidadConUnidad
import cl.moncopulli.app.ui.comun.esErrorReintentable
import cl.moncopulli.app.ui.comun.fechaHoraCortaChile
import cl.moncopulli.app.ui.comun.mensajeDeEscritura
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

enum class TipoAccion { APLICAR, OMITIR }

/** Diálogo abierto sobre una dosis. Vive en el ViewModel para sobrevivir a la rotación. */
data class AccionDosis(val dosis: DosisDelDia, val tipo: TipoAccion)

data class InicioUi(
    val cargando: Boolean = true,
    val actualizando: Boolean = false,
    val dosis: List<DosisDelDia> = emptyList(),
    val error: String? = null,
    val accion: AccionDosis? = null,
    val fechaAplicacion: OffsetDateTime? = null, // null = ahora
    val enviando: Boolean = false,
    val errorAccion: String? = null,   // se muestra dentro del diálogo
    val errorAccionReintentable: Boolean = false, // red o servidor: el botón dice "Reintentar"
    val aviso: String? = null,         // se muestra una vez en un Snackbar
    val enLinea: Boolean = true,       // omitir solo con conexión (no es idempotente)
)

/** Resultado de una acción: el texto del Snackbar y si hay que avisar a las demás pantallas. */
private data class Hecho(val aviso: String, val avisarCambio: Boolean = true)

@HiltViewModel
class InicioViewModel @Inject constructor(
    private val repo: DosisRepository,
    private val envios: EnviosRepository,
    private val cambios: CambiosDatos,
    monitor: MonitorConexion,
) : ViewModel() {

    private val _ui = MutableStateFlow(InicioUi())
    val ui: StateFlow<InicioUi> = _ui.asStateFlow()

    private var carga: Job? = null

    /** Última lista del servidor (o de la caché), sin filtrar. */
    private var delServidor: List<DosisDelDia> = emptyList()

    /** Dosis aplicadas desde este teléfono (por enviar o ya enviadas): se ocultan aunque el servidor aún diga PROGRAMADA. */
    private var aplicadasAqui: Set<Long> = emptySet()

    private fun visibles() = delServidor.filterNot { it.id in aplicadasAqui }

    init {
        cargar(deslizando = false)
        viewModelScope.launch { monitor.enLinea.collect { v -> _ui.update { it.copy(enLinea = v) } } }
        viewModelScope.launch {
            envios.dosisAplicadasAqui.collect { ids ->
                aplicadasAqui = ids
                _ui.update { it.copy(dosis = visibles()) }
            }
        }
        // Alguien escribió (esta pantalla, otra o el envío en segundo plano): recargar.
        viewModelScope.launch { cambios.cambios.collect { recargarPorCambio() } }
    }

    fun actualizar() = cargar(deslizando = true)

    /** Cancela una carga en curso (pudo empezar antes de la escritura) y carga de nuevo. */
    private fun recargarPorCambio() {
        carga?.cancel()
        cargar(deslizando = false)
    }

    private fun cargar(deslizando: Boolean) {
        if (carga?.isActive == true) return
        _ui.update { it.copy(actualizando = deslizando, cargando = !deslizando && it.dosis.isEmpty()) }
        carga = viewModelScope.launch {
            try {
                val l = repo.programadasHastaHoy()
                delServidor = l.datos
                // copy (no InicioUi nuevo) para no perder el diálogo ni el aviso abiertos.
                _ui.update {
                    it.copy(cargando = false, actualizando = false, dosis = visibles(), error = avisoDeCache(l.guardadoEn))
                }
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
        _ui.update { it.copy(accion = a, errorAccion = null, errorAccionReintentable = false, fechaAplicacion = null) }
    }

    /** Cerrar el diálogo. Mientras se envía no se cierra: así no quedan dudas de si se guardó. */
    fun cancelarAccion() {
        val estado = _ui.value
        if (estado.enviando) return
        _ui.update { it.copy(accion = null, errorAccion = null, errorAccionReintentable = false) }
        // Si hubo un error (p. ej. "ya fue aplicada por otro usuario"), la lista puede estar desactualizada.
        if (estado.errorAccion != null) cargar(deslizando = false)
    }

    fun elegirFechaAplicacion(f: OffsetDateTime?) {
        if (_ui.value.enviando) return
        _ui.update { it.copy(fechaAplicacion = f, errorAccion = null, errorAccionReintentable = false) }
    }

    fun confirmarAplicar() {
        val a = _ui.value.accion?.takeIf { it.tipo == TipoAccion.APLICAR } ?: return
        val fecha = _ui.value.fechaAplicacion
        // Misma regla que el servidor y el panel: hasta 5 minutos en el futuro (relojes desfasados).
        if (fecha != null && fecha.isAfter(OffsetDateTime.now().plusMinutes(5))) {
            _ui.update { it.copy(errorAccion = "La fecha de aplicación no puede ser futura.") }
            return
        }
        enviar(a.dosis) {
            when (val r = envios.aplicarDosis(a.dosis, fecha, resumen(a.dosis))) {
                is ResultadoEnvio.Enviado -> Hecho(textoAplicada(r.respuesta))
                // Nada cambió en el servidor todavía: no tiene sentido que las pantallas recarguen.
                ResultadoEnvio.EnCola -> Hecho(MSG_EN_COLA, avisarCambio = false)
            }
        }
    }

    fun confirmarOmitir(motivo: String) {
        val a = _ui.value.accion?.takeIf { it.tipo == TipoAccion.OMITIR } ?: return
        // fn_app_omitir_dosis no es idempotente: no se guarda para después ni se reintenta solo.
        if (!_ui.value.enLinea) {
            _ui.update { it.copy(errorAccion = MSG_OMITIR_SIN_RED) }
            return
        }
        if (motivo.isBlank()) {
            _ui.update { it.copy(errorAccion = "Indica por qué se omite la dosis.") }
            return
        }
        enviar(a.dosis) {
            repo.omitir(a.dosis.id, motivo)
            Hecho("Dosis omitida.")
        }
    }

    fun avisoMostrado() = _ui.update { it.copy(aviso = null) }

    /** Ejecuta la acción una sola vez a la vez; si sale bien quita la dosis de la lista. */
    private fun enviar(d: DosisDelDia, operacion: suspend () -> Hecho) {
        if (_ui.value.enviando) return
        _ui.update { it.copy(enviando = true, errorAccion = null, errorAccionReintentable = false) }
        viewModelScope.launch {
            try {
                val hecho = operacion()
                delServidor = delServidor.filterNot { it.id == d.id }
                _ui.update { it.copy(enviando = false, accion = null, aviso = hecho.aviso, dosis = visibles()) }
                if (hecho.avisarCambio) cambios.avisar() // Inicio, Animales e Inventario recargan
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "Falló la escritura de la dosis ${d.id}", e)
                _ui.update {
                    it.copy(
                        enviando = false,
                        errorAccion = mensajeDeEscritura(e),
                        errorAccionReintentable = esErrorReintentable(e),
                    )
                }
            }
        }
    }

    private fun resumen(d: DosisDelDia) =
        "${d.medicamento} · ${cantidadConUnidad(d.cantidad, d.unidad)} · DIIO ${d.diio ?: "sin DIIO"}"

    private fun textoAplicada(r: DosisAplicada): String {
        val base = if (r.yaRegistrada) "Esta dosis ya estaba aplicada por ti" else "Dosis aplicada"
        val lote = r.lote?.let { " (lote $it)" } ?: ""
        val resguardo = r.resguardoHasta?.let { " No entregar leche hasta ${fechaHoraCortaChile(it)}." } ?: ""
        return "$base$lote.$resguardo"
    }

    private companion object {
        const val TAG = "MoncopulliEscritura"
        const val MSG_OMITIR_SIN_RED = "Para omitir una dosis necesitas conexión."
        const val MSG_EN_COLA = "Sin conexión: la aplicación quedó guardada en el teléfono y se enviará sola."
    }
}
