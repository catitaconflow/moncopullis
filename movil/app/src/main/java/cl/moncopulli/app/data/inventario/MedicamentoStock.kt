package cl.moncopulli.app.data.inventario

import java.time.LocalDate
import java.time.temporal.ChronoUnit

/** Igual que DIAS_ALERTA del panel (panel/src/lib/vencimiento.ts). */
const val DIAS_ALERTA_VENCIMIENTO = 60L

data class LoteStock(
    val id: Long,
    val numero: String,
    val vencimiento: LocalDate,
    val stock: Double,
) {
    /** Días de calendario hasta el vencimiento; negativo = vencido (como diasParaVencer del panel). */
    fun diasParaVencer(hoy: LocalDate): Long = ChronoUnit.DAYS.between(hoy, vencimiento)
}

data class MedicamentoStock(
    val id: Long,
    val nombre: String,
    val principioActivo: String?,
    val unidad: String,              // ML, G o UNIDAD
    val stockActual: Double,
    val stockMinimo: Double,
    val lotes: List<LoteStock>,      // activos con stock > 0, el que vence antes primero
) {
    /** Misma regla que el panel, 0005 y el bot: estrictamente menor. */
    val bajoMinimo: Boolean get() = stockActual < stockMinimo
}