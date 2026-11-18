package cl.moncopulli.app.data.dosis

import java.math.BigDecimal
import java.time.OffsetDateTime
import java.util.UUID
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ParametrosDosisTest {
    private val fecha = OffsetDateTime.parse("2026-11-17T08:30:00-03:00")

    @Test
    fun aplicarSinFechaDejaQueElServidorUseSuHora() {
        val params = parametrosAplicarDosis(42L, null)

        assertEquals("42", params["p_dosis_id"]?.jsonPrimitive?.content)
        assertNull(params["p_fecha_aplicada"])
    }

    @Test
    fun aplicarConservaLaFechaYElDesfaseElegidos() {
        val params = parametrosAplicarDosis(42L, fecha)

        assertEquals(fecha.toString(), params["p_fecha_aplicada"]?.jsonPrimitive?.content)
    }

    @Test
    fun registroNormalizaTextoYConservaCantidadUuidYFecha() {
        val uuid = UUID.fromString("e253cdb6-59d8-4a98-9876-06c1b7654310")
        val registro = NuevoRegistro(
            uuid = uuid,
            diio = "123456789",
            medicamentoId = 7L,
            cantidad = BigDecimal("2.50"),
            indicadoPor = "  Dra. Soto  ",
            fecha = fecha,
            motivo = "  Mastitis  ",
            observaciones = "  Aplicación en terreno  ",
        )

        val params = parametrosRegistrarAplicacion(registro)

        assertEquals(uuid.toString(), params["p_uuid"]?.jsonPrimitive?.content)
        assertEquals("7", params["p_medicamento_id"]?.jsonPrimitive?.content)
        assertEquals("2.50", params["p_cantidad"]?.jsonPrimitive?.content)
        assertEquals("Dra. Soto", params["p_indicado_por"]?.jsonPrimitive?.content)
        assertEquals(fecha.toString(), params["p_fecha_aplicada"]?.jsonPrimitive?.content)
        assertEquals("Mastitis", params["p_motivo"]?.jsonPrimitive?.content)
        assertEquals("Aplicación en terreno", params["p_observaciones"]?.jsonPrimitive?.content)
    }

    @Test
    fun registroOmiteFechaYOpcionalesEnBlanco() {
        val registro = NuevoRegistro(
            uuid = UUID.fromString("e253cdb6-59d8-4a98-9876-06c1b7654310"),
            diio = "123456789",
            medicamentoId = 7L,
            cantidad = BigDecimal("1"),
            indicadoPor = "Dra. Soto",
            fecha = null,
            motivo = "   ",
            observaciones = " ",
        )

        val params = parametrosRegistrarAplicacion(registro)

        assertNull(params["p_fecha_aplicada"])
        assertNull(params["p_motivo"])
        assertNull(params["p_observaciones"])
    }

    @Test
    fun colaFijaLaHoraActualCuandoNoSeEligioUna() {
        val ahora = OffsetDateTime.parse("2026-11-17T10:15:00-03:00")

        assertEquals(ahora, fechaAplicacionParaCola(null, ahora))
        assertEquals(fecha, fechaAplicacionParaCola(fecha, ahora))
    }
}
