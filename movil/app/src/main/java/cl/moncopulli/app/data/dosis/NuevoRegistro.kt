package cl.moncopulli.app.data.dosis

import java.math.BigDecimal
import java.time.OffsetDateTime
import java.util.UUID

/** Registro en terreno: tratamiento + dosis aplicada en un solo paso (fn_app_registrar_aplicacion). */
data class NuevoRegistro(
    val uuid: UUID,               // lo genera la app al guardar; repetir con el mismo uuid no duplica
    val diio: String,
    val medicamentoId: Long,
    val cantidad: BigDecimal,     // BigDecimal: 2,5 viaja como 2.5 exacto (Double puede dar 2.4999…)
    val indicadoPor: String,
    val fecha: OffsetDateTime?,   // null = ahora
    val motivo: String?,
    val observaciones: String?,
)
