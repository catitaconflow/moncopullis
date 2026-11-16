package cl.moncopulli.app.ui.comun

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import cl.moncopulli.app.data.ZONA_CHILE
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.ZonedDateTime

private enum class PasoFechaHora { CERRADO, FECHA, HORA }

/**
 * Fecha y hora de aplicación. [valor] = null significa "Ahora" (el servidor usa now()).
 * "Cambiar" abre primero el calendario y luego el reloj; la hora se interpreta en hora de Chile.
 * No permite días futuros; la hora futura (tolerancia de 5 min) la valida quien envía, igual que el servidor.
 */
@Composable
fun CampoFechaHora(
    valor: OffsetDateTime?,
    onCambio: (OffsetDateTime?) -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier,
) {
    var paso by rememberSaveable { mutableStateOf(PasoFechaHora.CERRADO) }
    var diaElegido by rememberSaveable { mutableStateOf<Long?>(null) } // epochDay, entre el calendario y el reloj

    Column(modifier) {
        Text(
            "Fecha y hora de aplicación",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                valor?.let { fechaHoraCortaChile(it) } ?: "Ahora",
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.weight(1f),
            )
            if (valor != null) {
                TextButton(onClick = { onCambio(null) }, enabled = enabled) { Text("Ahora") }
            }
            TextButton(onClick = { paso = PasoFechaHora.FECHA }, enabled = enabled) { Text("Cambiar") }
        }
    }

    val base = (valor ?: OffsetDateTime.now()).atZoneSameInstant(ZONA_CHILE)
    when (paso) {
        PasoFechaHora.FECHA -> DialogoFecha(
            inicial = base.toLocalDate(),
            onElegir = { dia ->
                diaElegido = dia.toEpochDay()
                paso = PasoFechaHora.HORA
            },
            onCancelar = { paso = PasoFechaHora.CERRADO },
        )
        PasoFechaHora.HORA -> DialogoHora(
            inicial = base.toLocalTime(),
            onElegir = { hora ->
                val dia = diaElegido?.let(LocalDate::ofEpochDay) ?: base.toLocalDate()
                onCambio(ZonedDateTime.of(dia, hora, ZONA_CHILE).toOffsetDateTime())
                paso = PasoFechaHora.CERRADO
            },
            onCancelar = { paso = PasoFechaHora.CERRADO },
        )
        PasoFechaHora.CERRADO -> Unit
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DialogoFecha(inicial: LocalDate, onElegir: (LocalDate) -> Unit, onCancelar: () -> Unit) {
    val hoy = LocalDate.now(ZONA_CHILE)
    // DatePicker trabaja con milisegundos a medianoche UTC del día elegido (no en hora local).
    val estado = rememberDatePickerState(
        initialSelectedDateMillis = inicial.aMillisUtc(),
        yearRange = (hoy.year - 1)..hoy.year,
        selectableDates = object : SelectableDates {
            override fun isSelectableDate(utcTimeMillis: Long) = utcTimeMillis <= hoy.aMillisUtc()
            override fun isSelectableYear(year: Int) = year <= hoy.year
        },
    )
    DatePickerDialog(
        onDismissRequest = onCancelar,
        confirmButton = {
            // Botón relleno: es el paso principal y se distingue de "Cancelar" (OBS-04 a).
            Button(
                onClick = { estado.selectedDateMillis?.let { onElegir(it.aFechaUtc()) } },
                enabled = estado.selectedDateMillis != null,
            ) { Text("Siguiente") }
        },
        dismissButton = { TextButton(onClick = onCancelar) { Text("Cancelar") } },
    ) {
        DatePicker(state = estado)
    }
}

/** Reloj dentro de un AlertDialog, como en la guía oficial de Compose (Material 3 no trae uno listo). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DialogoHora(inicial: LocalTime, onElegir: (LocalTime) -> Unit, onCancelar: () -> Unit) {
    val estado = rememberTimePickerState(
        initialHour = inicial.hour,
        initialMinute = inicial.minute,
        is24Hour = true,
    )
    AlertDialog(
        onDismissRequest = onCancelar,
        confirmButton = {
            TextButton(onClick = { onElegir(LocalTime.of(estado.hour, estado.minute)) }) { Text("Aceptar") }
        },
        dismissButton = { TextButton(onClick = onCancelar) { Text("Cancelar") } },
        text = { TimePicker(state = estado) },
    )
}

private fun LocalDate.aMillisUtc(): Long = atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()

private fun Long.aFechaUtc(): LocalDate = Instant.ofEpochMilli(this).atZone(ZoneOffset.UTC).toLocalDate()
