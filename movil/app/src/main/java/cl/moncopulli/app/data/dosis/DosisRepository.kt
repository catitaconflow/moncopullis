package cl.moncopulli.app.data.dosis

import cl.moncopulli.app.data.ZONA_CHILE
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import java.time.LocalDate
import java.time.OffsetDateTime
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Singleton
class DosisRepository @Inject constructor(
    private val supabase: SupabaseClient,
) {
    /**
     * Dosis PROGRAMADAS hasta el fin de hoy (hora de Chile), incluidas las atrasadas de días
     * anteriores, de tratamientos no anulados. Más antiguas primero.
     */
    suspend fun programadasHastaHoy(): List<DosisDelDia> {
        val finDeHoy = LocalDate.now(ZONA_CHILE).plusDays(1).atStartOfDay(ZONA_CHILE).toInstant()
        return supabase.from("dosis")
            .select(columns = Columns.raw(COLUMNAS)) {
                filter {
                    eq("estado", "PROGRAMADA")
                    lt("fecha_programada", finDeHoy.toString())
                    // Para ver SOLO las de hoy, agrega:
                    // gte("fecha_programada", LocalDate.now(ZONA_CHILE).atStartOfDay(ZONA_CHILE).toInstant().toString())
                    exact("tratamiento.fecha_anulacion", null)
                }
                order(column = "fecha_programada", order = Order.ASCENDING)
                limit(count = 200)
            }
            .decodeList<DosisFila>()
            .map { it.aModelo() }
    }

    private companion object {
        // medicamento:medicamento_id(...) igual que el panel (dosis también apunta a medicamento vía lote).
        // !inner: sin él, el filtro sobre tratamiento no descarta la dosis, solo deja tratamiento en null.
        val COLUMNAS = """
            id, cantidad, fecha_programada,
            medicamento:medicamento_id(nombre_comercial, unidad_base),
            tratamiento:tratamiento_id!inner(animal:animal_id(id, diio, categoria))
        """.trimIndent()
    }
}

@Serializable
private data class DosisFila(
    val id: Long,
    val cantidad: Double,
    @SerialName("fecha_programada") val fechaProgramada: String,
    val medicamento: MedicamentoFila,
    val tratamiento: TratamientoFila,
)

@Serializable
private data class MedicamentoFila(
    @SerialName("nombre_comercial") val nombreComercial: String,
    @SerialName("unidad_base") val unidadBase: String,
)

@Serializable
private data class TratamientoFila(val animal: AnimalFila)

@Serializable
private data class AnimalFila(val id: Long, val diio: String? = null, val categoria: String)

private fun DosisFila.aModelo() = DosisDelDia(
    id = id,
    fechaProgramada = OffsetDateTime.parse(fechaProgramada), // PostgREST: "2026-11-12T13:00:00+00:00"
    cantidad = cantidad,
    unidad = medicamento.unidadBase,
    medicamento = medicamento.nombreComercial,
    animalId = tratamiento.animal.id,
    diio = tratamiento.animal.diio,
    categoria = tratamiento.animal.categoria,
)