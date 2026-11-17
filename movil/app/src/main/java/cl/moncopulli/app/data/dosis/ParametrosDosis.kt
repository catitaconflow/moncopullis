package cl.moncopulli.app.data.dosis

import java.time.OffsetDateTime
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Fija al guardar la hora que el servidor debe usar cuando una escritura espere en la cola offline. */
internal fun fechaAplicacionParaCola(fecha: OffsetDateTime?, ahora: OffsetDateTime): OffsetDateTime =
    fecha ?: ahora

/** Parámetros de fn_app_aplicar_dosis. Sin fecha, el servidor usa su hora actual. */
internal fun parametrosAplicarDosis(dosisId: Long, fecha: OffsetDateTime?): JsonObject = buildJsonObject {
    put("p_dosis_id", dosisId)
    // ISO 8601 con desfase: Postgres lo lee como timestamptz.
    fecha?.let { put("p_fecha_aplicada", it.toString()) }
}

/** Parámetros de fn_app_registrar_aplicacion; los opcionales vacíos se omiten. */
internal fun parametrosRegistrarAplicacion(registro: NuevoRegistro): JsonObject = buildJsonObject {
    put("p_uuid", registro.uuid.toString())
    put("p_diio", registro.diio)
    put("p_medicamento_id", registro.medicamentoId)
    put("p_cantidad", registro.cantidad)
    put("p_indicado_por", registro.indicadoPor.trim())
    registro.fecha?.let { put("p_fecha_aplicada", it.toString()) }
    registro.motivo?.trim()?.takeIf { it.isNotEmpty() }?.let { put("p_motivo", it) }
    registro.observaciones?.trim()?.takeIf { it.isNotEmpty() }?.let { put("p_observaciones", it) }
}
