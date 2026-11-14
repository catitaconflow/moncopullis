package cl.moncopulli.app.data.dosis

import cl.moncopulli.app.data.ZONA_CHILE
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.rpc
import java.time.LocalDate
import java.time.OffsetDateTime
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

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

    /**
     * Aplica una dosis PROGRAMADA. [fecha] = null → now() en el servidor; si no, la hora elegida
     * (el servidor rechaza fechas más de 5 min en el futuro).
     * El servidor elige el lote por FEFO. Idempotente si la aplicó el mismo usuario.
     * Lanza PostgrestRestException (P0001/42501) o un error de red.
     */
    suspend fun aplicar(dosisId: Long, fecha: OffsetDateTime? = null): DosisAplicada {
        val params = buildJsonObject {
            put("p_dosis_id", dosisId)
            // ISO 8601 con desfase, p. ej. "2026-11-14T08:30-03:00": Postgres lo lee como timestamptz.
            if (fecha != null) put("p_fecha_aplicada", fecha.toString())
        }
        val r = supabase.postgrest
            .rpc("fn_app_aplicar_dosis", params)
            .decodeAs<RespuestaApp>()
        return DosisAplicada(
            yaRegistrada = r.estado == "ya_registrado",
            lote = r.lote,
            resguardoHasta = r.resguardoHasta?.let(OffsetDateTime::parse),
        )
    }

    /** Omite una dosis PROGRAMADA. NO es idempotente: solo con conexión y sin reintentos automáticos. */
    suspend fun omitir(dosisId: Long, motivo: String) {
        supabase.postgrest.rpc(
            "fn_omitir_dosis",
            buildJsonObject {
                put("p_dosis_id", dosisId)
                put("p_motivo", motivo.trim())
            },
        )
    }

    /**
     * Registro en terreno. Idempotente por [NuevoRegistro.uuid]: si el servidor ya lo tiene responde
     * 'ya_registrado' sin tocar el stock. Los opcionales solo se envían si tienen valor (DEFAULT NULL).
     */
    suspend fun registrarAplicacion(r: NuevoRegistro): DosisAplicada {
        val params = buildJsonObject {
            put("p_uuid", r.uuid.toString())
            put("p_diio", r.diio)
            put("p_medicamento_id", r.medicamentoId)
            put("p_cantidad", r.cantidad)
            put("p_indicado_por", r.indicadoPor.trim())
            r.fecha?.let { put("p_fecha_aplicada", it.toString()) }
            r.motivo?.trim()?.takeIf { it.isNotEmpty() }?.let { put("p_motivo", it) }
            r.observaciones?.trim()?.takeIf { it.isNotEmpty() }?.let { put("p_observaciones", it) }
        }
        val resp = supabase.postgrest
            .rpc("fn_app_registrar_aplicacion", params)
            .decodeAs<RespuestaApp>()
        return DosisAplicada(
            yaRegistrada = resp.estado == "ya_registrado",
            lote = resp.lote,
            resguardoHasta = resp.resguardoHasta?.let(OffsetDateTime::parse),
        )
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

/** jsonb de fn_app_*: {estado, dosis_id, lote, resguardo_hasta [, tratamiento_id]}. */
@Serializable
private data class RespuestaApp(
    val estado: String,
    @SerialName("dosis_id") val dosisId: Long,
    val lote: String? = null,
    @SerialName("resguardo_hasta") val resguardoHasta: String? = null,
)

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