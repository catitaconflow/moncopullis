package cl.moncopulli.app.ui.inventario

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cl.moncopulli.app.data.inventario.DIAS_ALERTA_VENCIMIENTO
import cl.moncopulli.app.data.inventario.LoteStock
import cl.moncopulli.app.data.inventario.MedicamentoStock
import cl.moncopulli.app.data.inventario.MotivoSalida
import cl.moncopulli.app.ui.comun.Insignia
import cl.moncopulli.app.ui.comun.cantidadConUnidad
import cl.moncopulli.app.ui.comun.fechaCorta
import cl.moncopulli.app.ui.theme.Advertencia
import cl.moncopulli.app.ui.theme.AdvertenciaFondo
import cl.moncopulli.app.ui.theme.Urgente
import cl.moncopulli.app.ui.theme.UrgenteFondo
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventarioScreen(
    modifier: Modifier = Modifier,
    viewModel: InventarioViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val visibles = ui.visibles
    val snackbar = remember { SnackbarHostState() }

    // El aviso se muestra una vez; el importante queda hasta que se cierra a mano.
    LaunchedEffect(ui.aviso) {
        ui.aviso?.let {
            snackbar.showSnackbar(
                message = it.texto,
                withDismissAction = it.importante,
                duration = if (it.importante) SnackbarDuration.Indefinite else SnackbarDuration.Short,
            )
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
                item(key = "filtros") {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = ui.busqueda,
                            onValueChange = viewModel::buscar,
                            label = { Text("Buscar medicamento o principio activo") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            FilterChip(
                                selected = ui.soloBajoMinimo,
                                onClick = viewModel::alternarBajoMinimo,
                                label = { Text("Bajo mínimo (${ui.totalBajoMinimo})") },
                            )
                            Text(
                                "${visibles.size} de ${ui.medicamentos.size}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(start = 12.dp),
                            )
                        }
                    }
                }
                when {
                    ui.cargando -> item {
                        Box(Modifier.fillParentMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator()
                        }
                    }
                    ui.medicamentos.isEmpty() -> item { Aviso(ui.error ?: "No hay medicamentos activos.") }
                    else -> {
                        ui.error?.let { item { Aviso(it) } }
                        if (visibles.isEmpty()) item { Aviso("Ningún medicamento coincide con el filtro.") }
                        items(visibles, key = { it.id }) { m ->
                            TarjetaMedicamento(
                                m, ui.hoy,
                                puedeRegistrarSalida = ui.enLinea && !ui.enviando,
                                onRegistrarSalida = { viewModel.abrirSalida(m) },
                            )
                        }
                    }
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter))
    }

    ui.salida?.let { f ->
        DialogoSalida(
            f = f,
            hoy = ui.hoy,
            enviando = ui.enviando,
            enLinea = ui.enLinea,
            error = ui.errorSalida,
            onLote = viewModel::elegirLote,
            onMotivo = viewModel::elegirMotivo,
            onCantidad = viewModel::cambiarCantidad,
            onObservaciones = viewModel::cambiarObservaciones,
            onConfirmar = viewModel::confirmarSalida,
            onCancelar = viewModel::cerrarSalida,
        )
    }
}

@Composable
private fun Aviso(texto: String) {
    Text(
        texto,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(vertical = 16.dp),
    )
}

@Composable
private fun TarjetaMedicamento(
    m: MedicamentoStock,
    hoy: LocalDate,
    puedeRegistrarSalida: Boolean,
    onRegistrarSalida: () -> Unit,
) {
    OutlinedCard(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    m.nombre,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                // El panel usa rojo aquí; la app usa ámbar (rojo solo para lo urgente).
                if (m.bajoMinimo) Insignia("Bajo mínimo", Advertencia, AdvertenciaFondo)
            }
            m.principioActivo?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(
                "Stock: ${cantidadConUnidad(m.stockActual, m.unidad)} · mínimo ${cantidadConUnidad(m.stockMinimo, m.unidad)}",
                style = MaterialTheme.typography.bodyMedium,
                color = if (m.bajoMinimo) Advertencia else MaterialTheme.colorScheme.onSurface,
            )
            HorizontalDivider(Modifier.padding(vertical = 4.dp))
            if (m.lotes.isEmpty()) {
                Text(
                    "Sin lotes con stock.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            m.lotes.forEach { FilaLote(it, m.unidad, hoy) }
            if (m.lotes.isNotEmpty()) {
                // Desactivado sin conexión: fn_registrar_ajuste no es idempotente (no puede esperar en el outbox).
                TextButton(
                    onClick = onRegistrarSalida,
                    enabled = puedeRegistrarSalida,
                    modifier = Modifier.align(Alignment.End),
                ) { Text("Registrar salida") }
            }
        }
    }
}

@Composable
private fun FilaLote(l: LoteStock, unidad: String, hoy: LocalDate) {
    val dias = l.diasParaVencer(hoy)
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text("Lote ${l.numero}", style = MaterialTheme.typography.bodyMedium)
            Text(
                "Vence ${fechaCorta(l.vencimiento)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        val margen = Modifier.padding(end = 8.dp)
        when {
            dias < 0 -> Insignia("Vencido", Urgente, UrgenteFondo, margen)
            dias == 0L -> Insignia("Vence hoy", Advertencia, AdvertenciaFondo, margen)
            dias <= DIAS_ALERTA_VENCIMIENTO ->
                Insignia(if (dias == 1L) "Vence en 1 día" else "Vence en $dias días", Advertencia, AdvertenciaFondo, margen)
        }
        Text(
            cantidadConUnidad(l.stock, unidad),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

/** "ML" → "ml" (para la etiqueta del campo cantidad). */
private fun nombreUnidad(unidad: String): String = when (unidad) {
    "ML" -> "ml"
    "G" -> "g"
    "UNIDAD" -> "unidades"
    else -> unidad.lowercase()
}

@Composable
private fun DialogoSalida(
    f: FormSalida,
    hoy: LocalDate,
    enviando: Boolean,
    enLinea: Boolean,
    error: String?,
    onLote: (Long) -> Unit,
    onMotivo: (MotivoSalida) -> Unit,
    onCantidad: (String) -> Unit,
    onObservaciones: (String) -> Unit,
    onConfirmar: () -> Unit,
    onCancelar: () -> Unit,
) {
    val m = f.medicamento
    val otro = f.motivo == MotivoSalida.OTRO
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Registrar salida") },
        text = {
            // Con varios lotes el contenido no cabe en pantallas chicas: se desplaza.
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(m.nombre, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text("Lote", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 8.dp))
                m.lotes.forEach { l ->
                    val vencido = l.diasParaVencer(hoy) < 0
                    FilaOpcion(seleccionada = l.id == f.loteId, enabled = !enviando, onClick = { onLote(l.id) }) {
                        Column {
                            Text("Lote ${l.numero} · ${cantidadConUnidad(l.stock, m.unidad)}")
                            Text(
                                "Vence ${fechaCorta(l.vencimiento)}" + if (vencido) " · vencido" else "",
                                style = MaterialTheme.typography.bodySmall,
                                color = if (vencido) Urgente else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                Text("Motivo", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 8.dp))
                MotivoSalida.entries.forEach { mot ->
                    FilaOpcion(seleccionada = mot == f.motivo, enabled = !enviando, onClick = { onMotivo(mot) }) {
                        Text(mot.etiqueta)
                    }
                }
                OutlinedTextField(
                    value = f.cantidad,
                    onValueChange = onCantidad,
                    label = { Text("Cantidad (${nombreUnidad(m.unidad)})") },
                    singleLine = true,
                    enabled = !enviando,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Next),
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
                OutlinedTextField(
                    value = f.observaciones,
                    onValueChange = onObservaciones,
                    label = { Text(if (otro) "Observaciones (obligatorio)" else "Observaciones (opcional)") },
                    supportingText = { Text("${f.observaciones.length}/$MAX_OBSERVACIONES_SALIDA") },
                    enabled = !enviando,
                    minLines = 2,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier.fillMaxWidth(),
                )
                if (!enLinea) {
                    Text(
                        "Sin conexión: las salidas solo se registran con internet.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                error?.let { Text(it, color = Urgente) }
            }
        },
        confirmButton = {
            Button(onClick = onConfirmar, enabled = !enviando && enLinea) {
                if (enviando) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                else Text("Registrar salida")
            }
        },
        dismissButton = {
            TextButton(onClick = onCancelar, enabled = !enviando) { Text("Cancelar") }
        },
    )
}

/** Fila tipo radio: toda la fila es tocable (área táctil grande) y TalkBack la lee como botón de opción. */
@Composable
private fun FilaOpcion(
    seleccionada: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    contenido: @Composable () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .selectable(selected = seleccionada, enabled = enabled, role = Role.RadioButton, onClick = onClick)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(selected = seleccionada, onClick = null, enabled = enabled)
        Box(Modifier.padding(start = 8.dp)) { contenido() }
    }
}
