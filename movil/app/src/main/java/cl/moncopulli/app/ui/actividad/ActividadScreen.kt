package cl.moncopulli.app.ui.actividad

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cl.moncopulli.app.data.envio.Envio
import cl.moncopulli.app.data.envio.EstadoEnvio
import cl.moncopulli.app.data.envio.TipoEnvio
import cl.moncopulli.app.ui.comun.Insignia
import cl.moncopulli.app.ui.comun.fechaHoraCortaChile
import cl.moncopulli.app.ui.theme.Advertencia
import cl.moncopulli.app.ui.theme.AdvertenciaFondo
import cl.moncopulli.app.ui.theme.Urgente
import cl.moncopulli.app.ui.theme.UrgenteFondo
import java.time.OffsetDateTime

@Composable
fun ActividadScreen(
    modifier: Modifier = Modifier,
    viewModel: ActividadViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    // Se guarda solo el id: sobrevive a la rotación y no se confirma algo que ya cambió.
    var porDescartar by rememberSaveable { mutableStateOf<String?>(null) }
    val ahora = remember(ui) { OffsetDateTime.now() }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (ui.cargando) {
            item {
                Box(Modifier.fillParentMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
        }
        if (ui.vacio) {
            item { Nota("Aún no hay registros hechos desde este teléfono.") }
        }

        // Primero lo que requiere acción.
        if (ui.rechazados.isNotEmpty()) {
            item { Encabezado("Rechazados", ui.rechazados.size) }
            item {
                Nota(
                    "No quedaron registrados en el sistema. Corrige el problema (por ejemplo, stock) y " +
                        "vuelve a enviar, o descártalos si ya se resolvió de otra forma."
                )
            }
            items(ui.rechazados, key = { it.id }) { e ->
                TarjetaEnvio(e, ahora) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                    ) {
                        TextButton(onClick = { porDescartar = e.id }) { Text("Descartar") }
                        Button(onClick = { viewModel.volverAEnviar(e.id) }) { Text("Volver a enviar") }
                    }
                }
            }
        }

        if (ui.pendientes.isNotEmpty()) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Encabezado("Por enviar", ui.pendientes.size, Modifier.weight(1f))
                    TextButton(onClick = viewModel::enviarAhora, enabled = ui.enLinea) { Text("Enviar ahora") }
                }
            }
            item {
                Nota(
                    if (ui.enLinea) "Se están enviando. Esta lista se actualiza sola."
                    else "Se enviarán solos cuando vuelva la señal, aunque cierres la app. No cierres sesión: se perderían."
                )
            }
            items(ui.pendientes, key = { it.id }) { e -> TarjetaEnvio(e, ahora) }
        }

        if (ui.enviados.isNotEmpty()) {
            item { Encabezado("Enviados (últimos 7 días)", ui.enviados.size) }
            items(ui.enviados, key = { it.id }) { e -> TarjetaEnvio(e, ahora) }
        }
    }

    // Se busca por id en la lista actual: si ya no es RECHAZADO (p. ej. se volvió a enviar), no se muestra.
    ui.rechazados.firstOrNull { it.id == porDescartar }?.let { e ->
        AlertDialog(
            onDismissRequest = { porDescartar = null },
            title = { Text("Descartar registro") },
            text = { Text("\"${e.resumen}\" no se enviará y desaparecerá de esta lista. ¿Continuar?") },
            confirmButton = {
                Button(onClick = { viewModel.descartar(e.id); porDescartar = null }) { Text("Descartar") }
            },
            dismissButton = { TextButton(onClick = { porDescartar = null }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun Encabezado(titulo: String, cantidad: Int, modifier: Modifier = Modifier) {
    Text(
        "$titulo ($cantidad)",
        style = MaterialTheme.typography.titleMedium,
        modifier = modifier.padding(top = 8.dp),
    )
}

@Composable
private fun Nota(texto: String) {
    Text(
        texto,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
private fun TarjetaEnvio(
    e: Envio,
    ahora: OffsetDateTime,
    acciones: @Composable () -> Unit = {},
) {
    val rechazado = e.estado == EstadoEnvio.RECHAZADO
    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.outlinedCardColors(
            containerColor = if (rechazado) UrgenteFondo else MaterialTheme.colorScheme.surface,
        ),
        border = BorderStroke(1.dp, if (rechazado) Urgente else MaterialTheme.colorScheme.outline),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                when (e.tipo) {
                    TipoEnvio.APLICAR_DOSIS -> "Dosis programada"
                    TipoEnvio.REGISTRAR_APLICACION -> "Aplicación en terreno"
                },
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(e.resumen, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(
                "Aplicada: ${fechaHoraCortaChile(e.aplicadaEn ?: e.guardadoEn)}",
                style = MaterialTheme.typography.bodySmall,
            )
            when (e.estado) {
                EstadoEnvio.ENVIADO -> {
                    e.lote?.let { Text("Lote $it", style = MaterialTheme.typography.bodySmall) }
                    e.resguardoHasta?.takeIf { it.isAfter(ahora) }?.let {
                        Insignia(
                            "No entregar leche hasta ${fechaHoraCortaChile(it)}",
                            color = Advertencia,
                            fondo = AdvertenciaFondo,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
                EstadoEnvio.PENDIENTE -> e.error?.let { Nota(it) }
                EstadoEnvio.RECHAZADO -> e.error?.let {
                    Text(it, style = MaterialTheme.typography.bodyMedium, color = Urgente)
                }
            }
            acciones()
        }
    }
}
