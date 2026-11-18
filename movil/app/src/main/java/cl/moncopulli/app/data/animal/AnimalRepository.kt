package cl.moncopulli.app.data.animal

import cl.moncopulli.app.data.cache.CacheLectura
import cl.moncopulli.app.data.cache.JSON_CACHE
import cl.moncopulli.app.data.cache.Lectura
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

@Singleton
class AnimalRepository @Inject constructor(
    private val supabase: SupabaseClient,
    private val cache: CacheLectura,
) {
    /**
     * Animales sin baja, ordenados por DIIO, cada uno con su resguardo de leche vigente.
     * Sin red usa la caché; si vino de la caché, [Lectura.guardadoEn] es la fecha más antigua de las dos
     * listas. Los resguardos que vencieron después de guardarse los descarta la pantalla (compara con ahora).
     */
    suspend fun listarVivos(): Lectura<List<AnimalResumen>> = coroutineScope {
        val animales = async {
            cache.leer(
                clave = "animales",
                red = {
                    supabase.from("animal")
                        .select(columns = Columns.raw(COLS_ANIMAL)) {
                            filter { exact("fecha_baja", null) }
                            order(column = "diio", order = Order.ASCENDING)
                            limit(count = 1000)
                        }
                        .data
                },
                decodificar = { JSON_CACHE.decodeFromString(ListSerializer(AnimalFila.serializer()), it) },
            )
        }
        val resguardos = async {
            cache.leer(
                clave = "resguardos",
                red = {
                    // Misma regla que el bot (0008): dosis APLICADA cuyo fin de resguardo sigue en el futuro.
                    supabase.from("dosis")
                        .select(columns = Columns.raw(COLS_RESGUARDO)) {
                            filter {
                                eq("estado", "APLICADA")
                                gt("fin_resguardo_leche", Instant.now().toString())
                            }
                        }
                        .data
                },
                decodificar = { JSON_CACHE.decodeFromString(ListSerializer(ResguardoFila.serializer()), it) },
            )
        }
        val a = animales.await()
        val r = resguardos.await()
        val finPorAnimal: Map<Long, OffsetDateTime> = r.datos
            .groupBy({ it.tratamiento.animalId }, { OffsetDateTime.parse(it.finResguardoLeche) })
            .mapValues { (_, fechas) -> fechas.max() }

        Lectura(
            datos = a.datos.map { it.aModelo(finPorAnimal[it.id]) },
            guardadoEn = listOfNotNull(a.guardadoEn, r.guardadoEn).minOrNull(),
        )
    }

    private companion object {
        val COLS_ANIMAL = """
            id, diio, categoria, estado_productivo, fecha_nacimiento, observaciones,
            propietario:propietario_id(nombre_completo)
        """.trimIndent()
        const val COLS_RESGUARDO = "fin_resguardo_leche, tratamiento:tratamiento_id!inner(animal_id)"
    }
}

@Serializable
private data class AnimalFila(
    val id: Long,
    val diio: String? = null,
    val categoria: String,
    @SerialName("estado_productivo") val estadoProductivo: String? = null,
    @SerialName("fecha_nacimiento") val fechaNacimiento: String? = null,
    val observaciones: String? = null,
    val propietario: PropietarioFila? = null,
)

@Serializable
private data class PropietarioFila(@SerialName("nombre_completo") val nombreCompleto: String)

@Serializable
private data class ResguardoFila(
    @SerialName("fin_resguardo_leche") val finResguardoLeche: String,
    val tratamiento: TratamientoFila,
)

@Serializable
private data class TratamientoFila(@SerialName("animal_id") val animalId: Long)

private fun AnimalFila.aModelo(resguardo: OffsetDateTime?) = AnimalResumen(
    id = id,
    diio = diio,
    categoria = categoria,
    estadoProductivo = estadoProductivo,
    fechaNacimiento = fechaNacimiento?.let(LocalDate::parse),   // "2024-03-01"
    propietario = propietario?.nombreCompleto,
    observaciones = observaciones?.takeIf { it.isNotBlank() },
    resguardoHasta = resguardo,
)