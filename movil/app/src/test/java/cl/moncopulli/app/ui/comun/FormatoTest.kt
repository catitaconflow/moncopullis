package cl.moncopulli.app.ui.comun

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.OffsetDateTime

/**
 * Formato de horas, fechas, cantidades y etiquetas que ve el operario.
 * Las horas se muestran siempre en hora de Chile (America/Santiago), no en la del teléfono:
 * UTC-4 en invierno y UTC-3 en verano.
 */
class FormatoTest {

    @Test
    fun horaChile_enInvierno_restaCuatroHorasAUtc() {
        assertEquals("10:30", horaChile(OffsetDateTime.parse("2026-07-15T14:30:00Z")))
    }

    @Test
    fun horaChile_enVerano_restaTresHorasAUtc() {
        assertEquals("11:30", horaChile(OffsetDateTime.parse("2026-01-15T14:30:00Z")))
    }

    @Test
    fun fechaHoraCortaChile_usaElDiaDeChileYNoElDeUtc() {
        // 02:30 UTC del 17-11 todavía es el 16-11 a las 23:30 en Chile (horario de verano)
        assertEquals("16-11 23:30", fechaHoraCortaChile(OffsetDateTime.parse("2026-11-17T02:30:00Z")))
    }

    @Test
    fun diaCortoChile_muestraDiaYMesAbreviado() {
        // El punto final de la abreviatura depende de los datos de idioma del JDK: solo se exige el inicio
        val texto = diaCortoChile(OffsetDateTime.parse("2026-11-16T15:00:00Z"))
        assertTrue("Se obtuvo \"$texto\"", texto.startsWith("16 nov"))
    }

    @Test
    fun cantidadConUnidad_enteroSinDecimales() {
        assertEquals("5 ml", cantidadConUnidad(5.0, "ML"))
    }

    @Test
    fun cantidadConUnidad_decimalConComa() {
        assertEquals("2,5 ml", cantidadConUnidad(2.5, "ML"))
    }

    @Test
    fun cantidadConUnidad_unidadEnSingularYPlural() {
        assertEquals("1 unidad", cantidadConUnidad(1.0, "UNIDAD"))
        assertEquals("3 unidades", cantidadConUnidad(3.0, "UNIDAD"))
    }

    @Test
    fun etiquetas_valorConocidoYDesconocido() {
        assertEquals("Vaquilla", etiquetaCategoria("VAQUILLA"))
        assertEquals("BUEY", etiquetaCategoria("BUEY"))            // desconocido: se muestra tal cual
        assertEquals("Lactancia", etiquetaEstadoProductivo("LACTANCIA"))
        assertEquals("OTRO", etiquetaEstadoProductivo("OTRO"))
    }
}
