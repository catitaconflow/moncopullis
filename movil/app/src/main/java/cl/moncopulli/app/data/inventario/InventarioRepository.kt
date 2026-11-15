package cl.moncopulli.app.data.inventario

import cl.moncopulli.app.data.cache.CacheLectura
import cl.moncopulli.app.data.cache.JSON_CACHE
import cl.moncopulli.app.data.cache.Lectura
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.rpc
import java.math.BigDecimal
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@Singleton
class InventarioRepository @Inject constructor(
    private val supabase: SupabaseClient,
    private val cache: CacheLectura,
) {
    /**
     * Medicamentos activos con sus lotes, ordenados por nombre. Sin red usa la caché: el stock es el de
     * ese momento y no descuenta lo que esté pendiente de enviar (eso lo hace el servidor al recibirlo).
     */
    suspend fun listar(): Lectura<List<MedicamentoStock>> =
        cache.leer(
            clave = "inventario",
            red = {
                supabase.from("medicamento")
                    .select(columns = Columns.raw(COLUMNAS)) {
                        filter { eq("activo", true) }
                        order(column = "nombre_comercial", order = Order.ASCENDING)
                    }
                    .data
            },
            decodificar = { JSON_CACHE.decodeFromString(ListSerializer(MedicamentoFila.serializer()), it) },
        ).map { filas -> filas.map { it.aModelo() } }

    /**
     * Salida por ajuste (merma) de un lote con fn_registrar_ajuste (0005). NO es idempotente: cada llamada
     * que llega al servidor descuenta stock. Por eso solo se usa con conexión, sin outbox ni reintentos solos.
     * Lanza RestException si el servidor respondió con error, u otra excepción si no hubo respuesta.
     */
    suspend fun registrarSalida(loteId: Long, cantidad: BigDecimal, motivo: MotivoSalida, observaciones: String) {
        supabase.postgrest.rpc(
            "fn_registrar_ajuste",
            buildJsonObject {
                put("p_lote_id", loteId)
                put("p_tipo", "SALIDA_AJUSTE")
                put("p_cantidad", cantidad)
                put("p_motivo", motivo.name)
                // p_observaciones no tiene DEFAULT: hay que enviarlo siempre (null si está vacío), o
                // PostgREST no encuentra la función con esos argumentos (PGRST202).
                put("p_observaciones", observaciones.trim().takeIf { it.isNotEmpty() })
            },
        )
    }

    private companion object {
        // lote(...) embebido por su clave foránea lote.medicamento_id.
        const val COLUMNAS = "id, nombre_comercial, principio_activo, unidad_base, stock_actual, stock_minimo, " +
                "lote(id, numero_lote, fecha_vencimiento, stock_lote, activo)"
    }
}

@Serializable
private data class MedicamentoFila(
    val id: Long,
    @SerialName("nombre_comercial") val nombreComercial: String,
    @SerialName("principio_activo") val principioActivo: String? = null,
    @SerialName("unidad_base") val unidadBase: String,
    @SerialName("stock_actual") val stockActual: Double,
    @SerialName("stock_minimo") val stockMinimo: Double,
    val lote: List<LoteFila> = emptyList(),
)

@Serializable
private data class LoteFila(
    val id: Long,
    @SerialName("numero_lote") val numeroLote: String,
    @SerialName("fecha_vencimiento") val fechaVencimiento: String,
    @SerialName("stock_lote") val stockLote: Double,
    val activo: Boolean,
)

private fun MedicamentoFila.aModelo() = MedicamentoStock(
    id = id,
    nombre = nombreComercial,
    principioActivo = principioActivo?.takeIf { it.isNotBlank() },
    unidad = unidadBase,
    stockActual = stockActual,
    stockMinimo = stockMinimo,
    lotes = lote
        .filter { it.activo && it.stockLote > 0 }
        .map { LoteStock(it.id, it.numeroLote, LocalDate.parse(it.fechaVencimiento), it.stockLote) }
        .sortedBy { it.vencimiento },
)