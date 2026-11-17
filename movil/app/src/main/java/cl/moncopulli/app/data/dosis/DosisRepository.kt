package cl.moncopulli.app.data.dosis

import cl.moncopulli.app.data.ZONA_CHILE
import cl.moncopulli.app.data.cache.CacheLectura
import cl.moncopulli.app.data.cache.JSON_CACHE
import cl.moncopulli.app.data.cache.Lectura
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
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** RPC idempotentes de la 0014 (las únicas que pueden esperar en el outbox). */
const val RPC_APLICAR = "fn_app_aplicar_dosis"
const val RPC_REGISTRAR = "fn_app_registrar_aplicacion"

@Singleton
class DosisRepository @Inject constructor(
    private val supabase: SupabaseClient,
    private val cache: CacheLectura,
) {
    /**
     * Dosis PROGRAMADAS hasta el fin de hoy (hora de Chile), incluidas las atrasadas de días
     * anteriores, de tratamientos no anulados. Más antiguas primero.
     *
     * Al servidor se le piden también las de los próximos [DIAS_CACHE] días: así, si mañana se abre
     * la app sin red, la caché ya trae las dosis de mañana. El corte "hasta hoy" se hace aquí, al leer.
     */
    suspend fun programadasHastaHoy(): Lectura<List<DosisDelDia>> {
        val hoy = LocalDate.now(ZONA_CHILE)
        val finDeHoy = hoy.plusDays(1).atStartOfDay(ZONA_CHILE).toInstant()
        val horizonte = hoy.plusDays(1 + DIAS_CACHE).atStartOfDay(ZONA_CHILE).toInstant()
        return cache.leer(
            clave = "dosis",
            red = {
                supabase.from("dosis")
                    .select(columns = Columns.raw(COLUMNAS)) {
                        filter {
                            eq("estado", "PROGRAMADA")
                            lt("fecha_programada", horizonte.toString())
                            // Para ver SOLO las de hoy, agrega (y ajusta el filtro de abajo):
                            // gte("fecha_programada", LocalDate.now(ZONA_CHILE).atStartOfDay(ZONA_CHILE).toInstant().toString())
                            exact("tratamiento.fecha_anulacion", null)
                        }
                        order(column = "fecha_programada", order = Order.ASCENDING)
                        limit(count = 500)
                    }
                    .data
            },
            decodificar = { JSON_CACHE.decodeFromString(ListSerializer(DosisFila.serializer()), it) },
        ).map { filas ->
            filas.map { it.aModelo() }.filter { it.fechaProgramada.toInstant().isBefore(finDeHoy) }
        }
    }

    /**
     * Parámetros de fn_app_aplicar_dosis. [fecha] = null → now() en el servidor; si no, la hora
     * elegida (el servidor rechaza fechas más de 5 min en el futuro). El lote lo elige el servidor (FEFO).
     */
    fun paramsAplicar(dosisId: Long, fecha: OffsetDateTime?): JsonObject =
        parametrosAplicarDosis(dosisId, fecha)

    /**
     * Parámetros de fn_app_registrar_aplicacion (registro en terreno). Idempotente por p_uuid: si el
     * servidor ya lo tiene responde 'ya_registrado' sin tocar el stock. Los opcionales solo si tienen valor.
     */
    fun paramsRegistrar(r: NuevoRegistro): JsonObject = parametrosRegistrarAplicacion(r)

    /**
     * Llama a una RPC fn_app_* (ambas devuelven el mismo jsonb). La usan el envío directo y el worker.
     * Lanza PostgrestRestException (respuesta con error) o HttpRequestException (sin respuesta).
     */
    suspend fun llamarRpcApp(funcion: String, params: JsonObject): DosisAplicada {
        val r = supabase.postgrest
            .rpc(funcion, params)
            .decodeAs<RespuestaApp>()
        return DosisAplicada(
            yaRegistrada = r.estado == "ya_registrado",
            lote = r.lote,
            resguardoHasta = r.resguardoHasta?.let(OffsetDateTime::parse),
        )
    }

    /**
     * Omite una dosis PROGRAMADA con fn_app_omitir_dosis (0015: mismas reglas que el panel, origen APPMOVIL).
     * NO es idempotente: solo con conexión y sin reintentos automáticos.
     */
    suspend fun omitir(dosisId: Long, motivo: String) {
        supabase.postgrest.rpc(
            "fn_app_omitir_dosis",
            buildJsonObject {
                put("p_dosis_id", dosisId)
                put("p_motivo", motivo.trim())
            },
        )
    }

    private companion object {
        const val DIAS_CACHE = 7L

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
