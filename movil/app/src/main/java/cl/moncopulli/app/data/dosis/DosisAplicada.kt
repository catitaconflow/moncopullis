package cl.moncopulli.app.data.dosis

import java.time.OffsetDateTime

/** Resultado de aplicar una dosis (respuesta de fn_app_aplicar_dosis). */
data class DosisAplicada(
    val yaRegistrada: Boolean,           // true si este mismo usuario ya la había aplicado (reintento)
    val lote: String?,
    val resguardoHasta: OffsetDateTime?, // null si el medicamento no tiene resguardo de leche
)
