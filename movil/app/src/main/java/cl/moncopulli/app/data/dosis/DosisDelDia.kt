package cl.moncopulli.app.data.dosis

import java.time.OffsetDateTime

/** Dosis PROGRAMADA lista para mostrar en Inicio. */
data class DosisDelDia(
    val id: Long,
    val fechaProgramada: OffsetDateTime,
    val cantidad: Double,
    val unidad: String,        // ML, G o UNIDAD
    val medicamento: String,
    val animalId: Long,
    val diio: String?,         // animal.diio admite null
    val categoria: String,
)