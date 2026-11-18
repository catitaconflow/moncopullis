package cl.moncopulli.app.data.animal

import java.time.LocalDate
import java.time.OffsetDateTime

/** Animal vivo (sin fecha de baja) con su resguardo de leche vigente, si tiene. */
data class AnimalResumen(
    val id: Long,
    val diio: String?,
    val categoria: String,
    val estadoProductivo: String?,   // LACTANCIA o SECA (solo vacas)
    val fechaNacimiento: LocalDate?,
    val propietario: String?,        // null = animal propio
    val observaciones: String?,
    val resguardoHasta: OffsetDateTime?,
)