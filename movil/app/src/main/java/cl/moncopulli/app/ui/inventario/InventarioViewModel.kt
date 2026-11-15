package cl.moncopulli.app.ui.inventario

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cl.moncopulli.app.data.CambiosDatos
import cl.moncopulli.app.data.ZONA_CHILE
import cl.moncopulli.app.data.inventario.InventarioRepository
import cl.moncopulli.app.data.inventario.LoteStock
import cl.moncopulli.app.data.inventario.MedicamentoStock
import cl.moncopulli.app.data.inventario.MotivoSalida
import cl.moncopulli.app.data.red.MonitorConexion
import cl.moncopulli.app.ui.comun.LOCALE_CHILE
import cl.moncopulli.app.ui.comun.avisoDeCache
import cl.moncopulli.app.ui.comun.cantidadConUnidad
import cl.moncopulli.app.ui.comun.mensajeDeEscritura
import cl.moncopulli.app.ui.comun.mensajeDeLectura
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jan.supabase.exceptions.RestException
import java.math.BigDecimal
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Máximo de observaciones: fn_registrar_ajuste guarda left(observaciones, 300). */
const val MAX_OBSERVACIONES_SALIDA = 300

/** Formulario de salida abierto. Vive en el ViewModel para sobrevivir a la rotación. */
data class FormSalida(
    val medicamento: MedicamentoStock,
    val loteId: Long? = medicamento.lotes.singleOrNull()?.id, // con un solo lote se elige solo
    val motivo: MotivoSalida? = null,                          // sin valor por defecto: que se elija a conciencia
    val cantidad: String = "",
    val observaciones: String = "",
) {
    val lote: LoteStock? get() = medicamento.lotes.firstOrNull { it.id == loteId }
}

/** Mensaje de una vez en un Snackbar; [importante] = no se cierra solo (hay que leerlo). */
data class AvisoInventario(val texto: String, val importante: Boolean = false)

data class InventarioUi(
    val cargando: Boolean = true,
    val actualizando: Boolean = false,
    val medicamentos: List<MedicamentoStock> = emptyList(),
    val error: String? = null,
    val busqueda: String = "",
    val soloBajoMinimo: Boolean = false,
    val hoy: LocalDate = LocalDate.now(ZONA_CHILE),   // día de la última carga
    val enLinea: Boolean = true,                      // salidas solo con conexión (no son idempotentes)
    val salida: FormSalida? = null,
    val enviando: Boolean = false,
    val errorSalida: String? = null,                  // se muestra dentro del diálogo
    val aviso: AvisoInventario? = null,
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
    private val cambios: CambiosDatos,
    monitor: MonitorConexion,
) : ViewModel() {

    private val _ui = MutableStateFlow(InventarioUi())
    val ui: StateFlow<InventarioUi> = _ui.asStateFlow()

    private var carga: Job? = null

    init {
        cargar(deslizando = false)
        viewModelScope.launch { monitor.enLinea.collect { v -> _ui.update { it.copy(enLinea = v) } } }
        // Otra pantalla escribió (p. ej. se aplicó una dosis): recargar aunque esta pestaña no esté visible.
        viewModelScope.launch { cambios.cambios.collect { recargarPorCambio() } }
    }

    fun actualizar() = cargar(deslizando = true)

    fun buscar(texto: String) {
        _ui.update { it.copy(busqueda = texto) }
    }

    fun alternarBajoMinimo() {
        _ui.update { it.copy(soloBajoMinimo = !it.soloBajoMinimo) }
    }

    /** Cancela una carga en curso (pudo empezar antes de la escritura) y carga de nuevo. */
    private fun recargarPorCambio() {
        carga?.cancel()
        cargar(deslizando = false)
    }

    private fun cargar(deslizando: Boolean) {
        if (carga?.isActive == true) return
        _ui.update { it.copy(actualizando = deslizando, cargando = !deslizando && it.medicamentos.isEmpty()) }
        carga = viewModelScope.launch {
            try {
                val l = repo.listar()
                _ui.update {
                    it.copy(
                        cargando = false, actualizando = false, error = avisoDeCache(l.guardadoEn),
                        medicamentos = l.datos, hoy = LocalDate.now(ZONA_CHILE),
                    )
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _ui.update { it.copy(cargando = false, actualizando = false, error = mensajeDeLectura(e)) }
            }
        }
    }

    // --- Salida por ajuste (merma) ---

    fun abrirSalida(m: MedicamentoStock) {
        if (_ui.value.enviando || m.lotes.isEmpty()) return
        _ui.update { it.copy(salida = FormSalida(m), errorSalida = null) }
    }

    /** Cerrar el diálogo. Mientras se envía no se cierra: así no quedan dudas de si se guardó. */
    fun cerrarSalida() {
        if (_ui.value.enviando) return
        _ui.update { it.copy(salida = null, errorSalida = null) }
    }

    fun elegirLote(id: Long) = editarSalida { it.copy(loteId = id) }
    fun elegirMotivo(m: MotivoSalida) = editarSalida { it.copy(motivo = m) }
    fun cambiarCantidad(t: String) =
        editarSalida { it.copy(cantidad = t.filter { c -> c.isDigit() || c == ',' || c == '.' }.take(12)) }
    fun cambiarObservaciones(t: String) = editarSalida { it.copy(observaciones = t.take(MAX_OBSERVACIONES_SALIDA)) }

    private fun editarSalida(cambio: (FormSalida) -> FormSalida) {
        if (_ui.value.enviando) return
        _ui.update { u -> u.copy(salida = u.salida?.let(cambio), errorSalida = null) }
    }

    fun confirmarSalida() {
        val u = _ui.value
        val f = u.salida ?: return
        if (u.enviando) return
        if (!u.enLinea) {
            _ui.update { it.copy(errorSalida = MSG_SIN_RED) }
            return
        }
        val cantidad = f.cantidad.replace(',', '.').toBigDecimalOrNull()
        validar(f, cantidad)?.let { error ->
            _ui.update { it.copy(errorSalida = error) }
            return
        }
        val lote = f.lote!!
        val motivo = f.motivo!!
        val texto = "${cantidadConUnidad(cantidad!!.toDouble(), f.medicamento.unidad)} del lote ${lote.numero}"

        _ui.update { it.copy(enviando = true, errorSalida = null) }
        viewModelScope.launch {
            try {
                repo.registrarSalida(lote.id, cantidad, motivo, f.observaciones)
                _ui.update { it.copy(enviando = false, salida = null, aviso = AvisoInventario("Salida registrada: $texto.")) }
                cambios.avisar() // Inventario (esta pantalla), Inicio y Animales recargan
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "Falló la salida del lote ${lote.id}", e)
                if (e.servidorLaRechazo()) {
                    // P0001 (p. ej. stock insuficiente), 42501 o sesión: no se guardó; se puede corregir y reintentar.
                    _ui.update { it.copy(enviando = false, errorSalida = mensajeDeEscritura(e)) }
                } else {
                    // Sin respuesta: pudo guardarse igual. No se ofrece "Reintentar" para no descontar dos veces.
                    _ui.update {
                        it.copy(
                            enviando = false, salida = null,
                            aviso = AvisoInventario(
                                "No se pudo confirmar la salida de $texto. Antes de registrarla de nuevo, " +
                                        "revisa si el stock del lote ya bajó.",
                                importante = true,
                            ),
                        )
                    }
                    recargarPorCambio()
                }
            }
        }
    }

    fun avisoMostrado() = _ui.update { it.copy(aviso = null) }

    /** Mismas reglas que fn_registrar_ajuste (el servidor vuelve a validar con el stock real). */
    private fun validar(f: FormSalida, cantidad: BigDecimal?): String? {
        val lote = f.lote
        return when {
            lote == null -> "Elige el lote."
            f.motivo == null -> "Elige el motivo."
            cantidad == null || cantidad.signum() <= 0 -> "La cantidad debe ser mayor que 0."
            cantidad.stripTrailingZeros().scale() > 2 -> "Usa como máximo 2 decimales en la cantidad."
            cantidad > BigDecimal.valueOf(lote.stock) ->
                "El lote tiene solo ${cantidadConUnidad(lote.stock, f.medicamento.unidad)}."
            f.motivo == MotivoSalida.OTRO && f.observaciones.isBlank() ->
                "Con el motivo «Otro» explica la salida en observaciones."
            else -> null
        }
    }

    private companion object {
        const val TAG = "MoncopulliEscritura"
        const val MSG_SIN_RED = "Para registrar una salida necesitas conexión."
    }
}

/**
 * true = el servidor respondió con un error 4xx: la transacción se deshizo y no se descontó nada.
 * Sin respuesta (o 5xx, p. ej. un timeout de la pasarela) no se sabe si la RPC alcanzó a guardar.
 */
private fun Exception.servidorLaRechazo(): Boolean =
    this is RestException && response.status.value in 400..499
