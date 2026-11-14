package cl.moncopulli.app.data.envio

import cl.moncopulli.app.data.ZONA_CHILE
import java.time.Instant
import java.time.OffsetDateTime
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Una escritura hecha desde este teléfono, lista para mostrar en Actividad. */
data class Envio(
    val id: String,
    val tipo: TipoEnvio,
    val estado: String,                  // EstadoEnvio
    val resumen: String,
    val aplicadaEn: OffsetDateTime?,     // la fecha que se envía (fijada al tocar el botón)
    val guardadoEn: OffsetDateTime,
    val error: String?,                  // PENDIENTE: último fallo; RECHAZADO: motivo
    val lote: String?,
    val resguardoHasta: OffsetDateTime?,
)

internal fun EnvioEntity.aModelo() = Envio(
    id = id,
    tipo = TipoEnvio.valueOf(tipo),
    estado = estado,
    resumen = resumen,
    // La fecha ya está en los parámetros guardados: se lee de ahí para no agregar una columna.
    aplicadaEn = runCatching {
        Json.parseToJsonElement(parametros).jsonObject["p_fecha_aplicada"]
            ?.jsonPrimitive?.contentOrNull?.let(OffsetDateTime::parse)
    }.getOrNull(),
    guardadoEn = Instant.ofEpochMilli(creadoEn).atZone(ZONA_CHILE).toOffsetDateTime(),
    error = ultimoError,
    lote = lote,
    resguardoHasta = resguardoHasta?.let { runCatching { OffsetDateTime.parse(it) }.getOrNull() },
)
