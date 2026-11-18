package cl.moncopulli.app.data.inventario

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReglasInventarioTest {
    @Test
    fun stockBajoMinimoUsaComparacionEstricta() {
        assertTrue(medicamento(stock = 1.99, minimo = 2.0).bajoMinimo)
        assertFalse(medicamento(stock = 2.0, minimo = 2.0).bajoMinimo)
        assertFalse(medicamento(stock = 2.01, minimo = 2.0).bajoMinimo)
    }

    @Test
    fun diasParaVencerDistingueVencidoHoyYFuturo() {
        val hoy = LocalDate.parse("2026-11-17")
        val lote = LoteStock(
            id = 1L,
            numero = "L-1",
            vencimiento = hoy,
            stock = 1.0,
        )

        assertEquals(0L, lote.diasParaVencer(hoy))
        assertEquals(-1L, lote.copy(vencimiento = hoy.minusDays(1)).diasParaVencer(hoy))
        assertEquals(3L, lote.copy(vencimiento = hoy.plusDays(3)).diasParaVencer(hoy))
    }

    private fun medicamento(stock: Double, minimo: Double) = MedicamentoStock(
        id = 1L,
        nombre = "Medicamento",
        principioActivo = null,
        unidad = "ML",
        stockActual = stock,
        stockMinimo = minimo,
        lotes = emptyList(),
    )
}
