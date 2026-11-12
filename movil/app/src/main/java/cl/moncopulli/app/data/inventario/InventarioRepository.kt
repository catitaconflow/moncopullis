package cl.moncopulli.app.data.inventario

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Singleton
class InventarioRepository @Inject constructor(
    private val supabase: SupabaseClient,
) {
    /** Medicamentos activos con sus lotes, ordenados por nombre. */
    suspend fun listar(): List<MedicamentoStock> =
        supabase.from("medicamento")
            .select(columns = Columns.raw(COLUMNAS)) {
                filter { eq("activo", true) }
                order(column = "nombre_comercial", order = Order.ASCENDING)
            }
            .decodeList<MedicamentoFila>()
            .map { it.aModelo() }

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