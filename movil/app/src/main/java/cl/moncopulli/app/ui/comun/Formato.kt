package cl.moncopulli.app.ui.comun

import cl.moncopulli.app.data.ZONA_CHILE
import java.text.NumberFormat
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

val LOCALE_CHILE: Locale = Locale.forLanguageTag("es-CL")
private val HORA = DateTimeFormatter.ofPattern("HH:mm", LOCALE_CHILE)
private val DIA_CORTO = DateTimeFormatter.ofPattern("d MMM", LOCALE_CHILE)
private val FECHA_LARGA = DateTimeFormatter.ofPattern("EEEE d 'de' MMMM", LOCALE_CHILE)

/** 2.5, "ML" → "2,5 ml". */
fun cantidadConUnidad(cantidad: Double, unidad: String): String {
    val nf = NumberFormat.getNumberInstance(LOCALE_CHILE).apply { maximumFractionDigits = 2 }
    val u = when (unidad) {
        "ML" -> "ml"
        "G" -> "g"
        "UNIDAD" -> if (cantidad == 1.0) "unidad" else "unidades"
        else -> unidad.lowercase()
    }
    return "${nf.format(cantidad)} $u"
}

fun etiquetaCategoria(categoria: String): String = when (categoria) {
    "VACA" -> "Vaca"
    "VAQUILLA" -> "Vaquilla"
    "TERNERO" -> "Ternero"
    "TORO" -> "Toro"
    else -> categoria
}

fun horaChile(f: OffsetDateTime): String = f.atZoneSameInstant(ZONA_CHILE).format(HORA)

fun diaCortoChile(f: OffsetDateTime): String = f.atZoneSameInstant(ZONA_CHILE).format(DIA_CORTO)

/** "Jueves 12 de noviembre". */
fun fechaLarga(dia: LocalDate): String =
    dia.format(FECHA_LARGA).replaceFirstChar { it.titlecase(LOCALE_CHILE) }

private val FECHA_HORA_CORTA = DateTimeFormatter.ofPattern("dd-MM HH:mm", LOCALE_CHILE)
private val FECHA_CORTA = DateTimeFormatter.ofPattern("dd-MM-yyyy", LOCALE_CHILE)

/** "14-11 18:30", igual que textoResguardo del panel. */
fun fechaHoraCortaChile(f: OffsetDateTime): String = f.atZoneSameInstant(ZONA_CHILE).format(FECHA_HORA_CORTA)

fun fechaCorta(dia: LocalDate): String = dia.format(FECHA_CORTA)

fun etiquetaEstadoProductivo(estado: String): String = when (estado) {
    "LACTANCIA" -> "Lactancia"
    "SECA" -> "Seca"
    else -> estado
}