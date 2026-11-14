package cl.moncopulli.app.ui.registrar

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cl.moncopulli.app.data.CambiosDatos
import cl.moncopulli.app.data.ZONA_CHILE
import cl.moncopulli.app.data.animal.AnimalRepository
import cl.moncopulli.app.data.animal.AnimalResumen
import cl.moncopulli.app.data.dosis.DosisAplicada
import cl.moncopulli.app.data.dosis.NuevoRegistro
import cl.moncopulli.app.data.envio.EnviosRepository
import cl.moncopulli.app.data.envio.ResultadoEnvio
import cl.moncopulli.app.data.inventario.InventarioRepository
import cl.moncopulli.app.data.inventario.MedicamentoStock
import cl.moncopulli.app.ui.comun.cantidadConUnidad
import cl.moncopulli.app.ui.comun.fechaHoraCortaChile
import cl.moncopulli.app.ui.comun.mensajeDeEscritura
import cl.moncopulli.app.ui.comun.mensajeDeLectura
import dagger.hilt.android.lifecycle.HiltViewModel
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Límites del servidor (0014). */
const val MAX_INDICADO_POR = 120
const val MAX_MOTIVO = 200
const val MAX_OBSERVACIONES = 500 // el servidor no limita; la app sí, para no aceptar textos enormes

/** Stock de lotes no vencidos: lo que el servidor puede usar hoy. */
fun MedicamentoStock.stockVigente(hoy: LocalDate): Double =
    lotes.filter { it.diasParaVencer(hoy) >= 0 }.sumOf { it.stock }

data class RegistrarUi(
    // Catálogos (para elegir medicamento y confirmar el animal)
    val cargandoCatalogos: Boolean = true,
    val errorCatalogos: String? = null,
    val animales: Map<String, AnimalResumen> = emptyMap(),   // por DIIO
    val medicamentos: List<MedicamentoStock> = emptyList(),  // solo con stock vigente
    val hoy: LocalDate = LocalDate.now(ZONA_CHILE),
    // Formulario
    val diio: String = "",
    val medicamentoId: Long? = null,
    val cantidad: String = "",
    val indicadoPor: String = "",
    val fecha: OffsetDateTime? = null,   // null = ahora
    val motivo: String = "",
    val observaciones: String = "",
    // Envío
    val enviando: Boolean = false,
    val error: String? = null,
    val aviso: String? = null,
) {
    val medicamento: MedicamentoStock? get() = medicamentos.firstOrNull { it.id == medicamentoId }
    val animal: AnimalResumen? get() = animales[diio]
}

@HiltViewModel
class RegistrarViewModel @Inject constructor(
    private val envios: EnviosRepository,
    private val animalRepo: AnimalRepository,
    private val inventarioRepo: InventarioRepository,
    private val cambios: CambiosDatos,
) : ViewModel() {

    private val _ui = MutableStateFlow(RegistrarUi())
    val ui: StateFlow<RegistrarUi> = _ui.asStateFlow()

    /**
     * uuid del registro en curso. Se crea en el primer "Registrar" y se conserva hasta que el servidor
     * confirma. Así, si se corta la red después de que el servidor guardó, el reintento responde
     * 'ya_registrado' en vez de descontar stock dos veces. No se cambia al editar el formulario por
     * el mismo motivo: no sabemos si el intento anterior llegó.
     * Si queda en la cola, el uuid pasa a ser de la fila del outbox y aquí se olvida.
     */
    private var uuidPendiente: UUID? = null

    private var carga: Job? = null

    init {
        cargarCatalogos()
        viewModelScope.launch { cambios.cambios.collect { cargarCatalogos(forzar = true) } }
    }

    fun reintentarCatalogos() = cargarCatalogos()

    private fun cargarCatalogos(forzar: Boolean = false) {
        if (forzar) carga?.cancel() else if (carga?.isActive == true) return
        _ui.update { it.copy(cargandoCatalogos = it.medicamentos.isEmpty(), errorCatalogos = null) }
        carga = viewModelScope.launch {
            try {
                val hoy = LocalDate.now(ZONA_CHILE)
                val (animales, medicamentos) = coroutineScope {
                    // Sin red llegan desde la caché: el servidor valida igual al recibir el registro.
                    val a = async { animalRepo.listarVivos().datos }
                    val m = async { inventarioRepo.listar().datos }
                    a.await() to m.await()
                }
                _ui.update {
                    it.copy(
                        cargandoCatalogos = false,
                        hoy = hoy,
                        animales = animales.filter { a -> a.diio != null }.associateBy { a -> a.diio!! },
                        medicamentos = medicamentos.filter { m -> m.stockVigente(hoy) > 0 },
                    )
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _ui.update { it.copy(cargandoCatalogos = false, errorCatalogos = mensajeDeLectura(e)) }
            }
        }
    }

    // --- Campos (cada cambio borra el error mostrado) ---

    fun cambiarDiio(t: String) = editar { it.copy(diio = t.filter(Char::isDigit).take(9)) }
    fun elegirMedicamento(id: Long) = editar { it.copy(medicamentoId = id) }
    fun cambiarCantidad(t: String) = editar { it.copy(cantidad = t.filter { c -> c.isDigit() || c == ',' || c == '.' }.take(12)) }
    fun cambiarIndicadoPor(t: String) = editar { it.copy(indicadoPor = t.take(MAX_INDICADO_POR)) }
    fun cambiarFecha(f: OffsetDateTime?) = editar { it.copy(fecha = f) }
    fun cambiarMotivo(t: String) = editar { it.copy(motivo = t.take(MAX_MOTIVO)) }
    fun cambiarObservaciones(t: String) = editar { it.copy(observaciones = t.take(MAX_OBSERVACIONES)) }

    private fun editar(cambio: (RegistrarUi) -> RegistrarUi) {
        if (_ui.value.enviando) return
        _ui.update { cambio(it).copy(error = null) }
    }

    fun avisoMostrado() = _ui.update { it.copy(aviso = null) }

    // --- Envío ---

    fun registrar() {
        val u = _ui.value
        if (u.enviando) return
        val cantidad = u.cantidad.replace(',', '.').toBigDecimalOrNull()
        val error = validar(u, cantidad)
        if (error != null) {
            _ui.update { it.copy(error = error) }
            return
        }
        val uuid = uuidPendiente ?: UUID.randomUUID().also { uuidPendiente = it }
        val nuevo = NuevoRegistro(
            uuid = uuid,
            diio = u.diio,
            medicamentoId = u.medicamentoId!!,   // validar() garantiza que no es null
            cantidad = cantidad!!,
            indicadoPor = u.indicadoPor,
            fecha = u.fecha,
            motivo = u.motivo,
            observaciones = u.observaciones,
        )
        _ui.update { it.copy(enviando = true, error = null) }
        viewModelScope.launch {
            try {
                val m = u.medicamento!!
                val resumen = "${m.nombre} · ${cantidadConUnidad(nuevo.cantidad.toDouble(), m.unidad)} · DIIO ${nuevo.diio}"
                val r = envios.registrarAplicacion(nuevo, resumen)
                uuidPendiente = null
                val aviso = when (r) {
                    is ResultadoEnvio.Enviado -> textoRegistrado(nuevo.diio, r.respuesta)
                    ResultadoEnvio.EnCola ->
                        "Sin conexión: el registro de ${nuevo.diio} quedó guardado en el teléfono y se enviará solo."
                }
                // Se conservan medicamento y "indicado por": lo habitual es tratar varios animales igual.
                _ui.update {
                    it.copy(
                        enviando = false,
                        aviso = aviso,
                        diio = "", cantidad = "", fecha = null, motivo = "", observaciones = "",
                    )
                }
                // En cola no cambió nada en el servidor todavía: el worker avisará al enviarlo.
                if (r is ResultadoEnvio.Enviado) cambios.avisar() // Animales, Inventario y este formulario recargan
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "Falló el registro $uuid", e)
                _ui.update { it.copy(enviando = false, error = mensajeDeEscritura(e)) }
            }
        }
    }

    /** Mismas reglas y mensajes que fn_app_registrar_aplicacion, para avisar antes de enviar. */
    private fun validar(u: RegistrarUi, cantidad: BigDecimal?): String? = when {
        !Regex("^[0-9]{9}$").matches(u.diio) -> "El DIIO debe tener 9 dígitos."
        u.medicamentoId == null || u.medicamento == null -> "Elige el medicamento."
        cantidad == null || cantidad.signum() <= 0 -> "La cantidad debe ser mayor que 0."
        cantidad.stripTrailingZeros().scale() > 2 -> "Usa como máximo 2 decimales en la cantidad."
        u.indicadoPor.isBlank() -> "Indica quién prescribe el tratamiento."
        u.fecha != null && u.fecha.isAfter(OffsetDateTime.now().plusMinutes(5)) ->
            "La fecha de aplicación no puede ser futura."
        else -> null
    }

    private fun textoRegistrado(diio: String, r: DosisAplicada): String {
        if (r.yaRegistrada) return "Este registro ya se había guardado."
        val lote = r.lote?.let { " (lote $it)" } ?: ""
        val resguardo = r.resguardoHasta?.let { " No entregar leche hasta ${fechaHoraCortaChile(it)}." } ?: ""
        return "Aplicación registrada para $diio$lote.$resguardo"
    }

    private companion object {
        const val TAG = "MoncopulliEscritura"
    }
}
