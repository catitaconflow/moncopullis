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

/**
 * Rechazos que reenviar nunca puede arreglar (OBS-02): la dosis ya la aplicó otro usuario, o el uuid
 * pertenece a un registro de otro usuario. Las RPC no devuelven un código propio para estos casos,
 * así que se reconocen por el texto de fn_error en 0014/0015 (fn_app_aplicar_dosis y
 * fn_app_registrar_aplicacion). LIMITACIÓN: si una migración cambia esos textos, hay que cambiarlos aquí.
 */
private val RECHAZOS_DEFINITIVOS = listOf(
    "ya fue aplicada por otro usuario",
    "pertenece a otro usuario",
)

/** true = en Actividad solo se ofrece "Descartar". */
val Envio.rechazoDefinitivo: Boolean
    get() = error?.let { e -> RECHAZOS_DEFINITIVOS.any { e.contains(it, ignoreCase = true) } } == true

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
