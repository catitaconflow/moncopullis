package cl.moncopulli.app.data.inventario

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/** Días para vencer de un lote y la regla de stock bajo mínimo (la misma del panel, la 0005 y el bot). */
class MedicamentoStockTest {

    private val hoy = LocalDate.of(2026, 11, 16)

    private fun lote(vence: LocalDate) = LoteStock(id = 1, numero = "L-1", vencimiento = vence, stock = 10.0)

    private fun medicamento(actual: Double, minimo: Double) = MedicamentoStock(
        id = 1, nombre = "Prueba", principioActivo = null, unidad = "ML",
        stockActual = actual, stockMinimo = minimo, lotes = emptyList(),
    )

    @Test
    fun diasParaVencer_venceHoy_esCero() {
        assertEquals(0L, lote(hoy).diasParaVencer(hoy))
    }

    @Test
    fun diasParaVencer_venceManana_esUno() {
        assertEquals(1L, lote(hoy.plusDays(1)).diasParaVencer(hoy))
    }

    @Test
    fun diasParaVencer_vencidoAyer_esNegativo() {
        assertEquals(-1L, lote(hoy.minusDays(1)).diasParaVencer(hoy))
    }

    @Test
    fun bajoMinimo_stockIgualAlMinimo_noEsBajoMinimo() {
        assertFalse(medicamento(actual = 50.0, minimo = 50.0).bajoMinimo)
    }

    @Test
    fun bajoMinimo_stockMenorAlMinimo_esBajoMinimo() {
        assertTrue(medicamento(actual = 49.5, minimo = 50.0).bajoMinimo)
    }
}
