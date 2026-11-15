package cl.moncopulli.app.ui.inicio

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cl.moncopulli.app.data.ZONA_CHILE
import cl.moncopulli.app.data.dosis.DosisDelDia
import cl.moncopulli.app.ui.comun.AvisoLista
import cl.moncopulli.app.ui.comun.CampoFechaHora
import cl.moncopulli.app.ui.comun.cantidadConUnidad
import cl.moncopulli.app.ui.comun.diaCortoChile
import cl.moncopulli.app.ui.comun.etiquetaCategoria
import cl.moncopulli.app.ui.comun.fechaLarga
import cl.moncopulli.app.ui.comun.horaChile
import cl.moncopulli.app.ui.theme.Urgente
import cl.moncopulli.app.ui.theme.UrgenteFondo
import java.time.LocalDate
import java.time.OffsetDateTime

private const val MAX_MOTIVO = 300 // fn_omitir_dosis guarda left(motivo, 300)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InicioScreen(
    nombre: String,
    modifier: Modifier = Modifier,
    viewModel: InicioViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    // Se recalculan cada vez que llega una lista nueva.
    val ahora = remember(ui.dosis) { OffsetDateTime.now() }
    val hoy = remember(ui.dosis) { LocalDate.now(ZONA_CHILE) }
    val snackbar = remember { SnackbarHostState() }

    // El aviso se muestra una vez; se marca como mostrado cuando el Snackbar se cierra.
    LaunchedEffect(ui.aviso) {
        ui.aviso?.let {
            snackbar.showSnackbar(it)
            viewModel.avisoMostrado()
        }
    }

    Box(modifier.fillMaxSize()) {
        PullToRefreshBox(
            isRefreshing = ui.actualizando,
            onRefresh = viewModel::actualizar,
            modifier = Modifier.fillMaxSize(),
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item {
                    Column(Modifier.padding(bottom = 8.dp)) {
                        Text("Hola, $nombre", style = MaterialTheme.typography.titleLarge)
                        Text(
                            fechaLarga(hoy),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                when {
                    ui.cargando -> item {
                        Box(Modifier.fillParentMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator()
                        }
                    }
                    ui.dosis.isEmpty() -> item {
                        AvisoLista(
                            ui.error ?: "No hay dosis programadas para hoy.",
                            onReintentar = if (ui.error != null) viewModel::actualizar else null,
                        )
                    }
                    else -> {
                        ui.error?.let { item { AvisoLista(it) } }
                        items(ui.dosis, key = { it.id }) { d ->
                            TarjetaDosis(
                                d = d,
                                ahora = ahora,
                                hoy = hoy,
                                habilitada = !ui.enviando,
                                puedeOmitir = ui.enLinea,
                                onAplicar = { viewModel.pedirAplicar(d) },
                                onOmitir = { viewModel.pedirOmitir(d) },
                            )
                        }
                    }
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter))
    }

    ui.accion?.let { a ->
        when (a.tipo) {
            TipoAccion.APLICAR -> DialogoAplicar(
                d = a.dosis,
                fecha = ui.fechaAplicacion,
                onCambiarFecha = viewModel::elegirFechaAplicacion,
                enviando = ui.enviando,
                error = ui.errorAccion,
                onConfirmar = viewModel::confirmarAplicar,
                onCancelar = viewModel::cancelarAccion,
            )
            TipoAccion.OMITIR -> DialogoOmitir(
                d = a.dosis,
                enviando = ui.enviando,
                enLinea = ui.enLinea,
                error = ui.errorAccion,
                onConfirmar = viewModel::confirmarOmitir,
                onCancelar = viewModel::cancelarAccion,
            )
        }
    }
}

@Composable
private fun TarjetaDosis(
    d: DosisDelDia,
    ahora: OffsetDateTime,
    hoy: LocalDate,
    habilitada: Boolean,
    puedeOmitir: Boolean,
    onAplicar: () -> Unit,
    onOmitir: () -> Unit,
) {
    val atrasada = d.fechaProgramada.isBefore(ahora)   // misma regla que el servidor (0005)
    val esDeHoy = d.fechaProgramada.atZoneSameInstant(ZONA_CHILE).toLocalDate() == hoy

    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.outlinedCardColors(
            containerColor = if (atrasada) UrgenteFondo else MaterialTheme.colorScheme.surface,
        ),
        border = BorderStroke(1.dp, if (atrasada) Urgente else MaterialTheme.colorScheme.outline),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.width(64.dp)) {
                    Text(
                        horaChile(d.fechaProgramada),
                        style = MaterialTheme.typography.titleMedium,
                        color = if (atrasada) Urgente else MaterialTheme.colorScheme.onSurface,
                    )
                    if (!esDeHoy) {
                        Text(
                            diaCortoChile(d.fechaProgramada),
                            style = MaterialTheme.typography.bodySmall,
                            color = if (atrasada) Urgente else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        d.diio ?: "Sin DIIO",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        "${d.medicamento} · ${cantidadConUnidad(d.cantidad, d.unidad)}",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Text(
                        etiquetaCategoria(d.categoria),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (atrasada) {
                    Text("Atrasada", style = MaterialTheme.typography.labelMedium, color = Urgente)
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
            ) {
                TextButton(onClick = onOmitir, enabled = habilitada && puedeOmitir) { Text("Omitir") }
                Button(onClick = onAplicar, enabled = habilitada) { Text("Aplicar") }
            }
        }
    }
}

@Composable
private fun DialogoAplicar(
    d: DosisDelDia,
    fecha: OffsetDateTime?,
    onCambiarFecha: (OffsetDateTime?) -> Unit,
    enviando: Boolean,
    error: String?,
    onConfirmar: () -> Unit,
    onCancelar: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Aplicar dosis") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("${d.medicamento} · ${cantidadConUnidad(d.cantidad, d.unidad)}")
                Text("Animal: ${d.diio ?: "Sin DIIO"}")
                CampoFechaHora(valor = fecha, onCambio = onCambiarFecha, enabled = !enviando)
                Text(
                    "Se descuenta del lote vigente que vence primero.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                error?.let { Text(it, color = Urgente) }
            }
        },
        confirmButton = {
            Button(onClick = onConfirmar, enabled = !enviando) {
                if (enviando) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                else Text(if (error != null) "Reintentar" else "Aplicar")
            }
        },
        dismissButton = {
            TextButton(onClick = onCancelar, enabled = !enviando) { Text("Cancelar") }
        },
    )
}

@Composable
private fun DialogoOmitir(
    d: DosisDelDia,
    enviando: Boolean,
    enLinea: Boolean,
    error: String?,
    onConfirmar: (String) -> Unit,
    onCancelar: () -> Unit,
) {
    // rememberSaveable con la dosis como clave: el texto sobrevive a la rotación y se limpia al cambiar de dosis.
    var motivo by rememberSaveable(d.id) { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Omitir dosis") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("${d.medicamento} · ${cantidadConUnidad(d.cantidad, d.unidad)} a ${d.diio ?: "Sin DIIO"}")
                OutlinedTextField(
                    value = motivo,
                    onValueChange = { motivo = it.take(MAX_MOTIVO) },
                    label = { Text("Motivo") },
                    supportingText = { Text("${motivo.length}/$MAX_MOTIVO") },
                    enabled = !enviando,
                    minLines = 2,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier.fillMaxWidth(),
                )
                if (!enLinea) {
                    Text(
                        "Sin conexión: omitir solo funciona con internet.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                error?.let { Text(it, color = Urgente) }
            }
        },
        confirmButton = {
            Button(onClick = { onConfirmar(motivo) }, enabled = !enviando && enLinea && motivo.isNotBlank()) {
                if (enviando) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                else Text("Omitir dosis")
            }
        },
        dismissButton = {
            TextButton(onClick = onCancelar, enabled = !enviando) { Text("Cancelar") }
        },
    )
}
