package cl.moncopulli.app.ui.registrar

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cl.moncopulli.app.data.inventario.MedicamentoStock
import cl.moncopulli.app.ui.comun.CampoFechaHora
import cl.moncopulli.app.ui.comun.LOCALE_CHILE
import cl.moncopulli.app.ui.comun.cantidadConUnidad
import cl.moncopulli.app.ui.comun.etiquetaCategoria
import cl.moncopulli.app.ui.comun.etiquetaEstadoProductivo
import cl.moncopulli.app.ui.comun.fechaHoraCortaChile
import cl.moncopulli.app.ui.theme.Advertencia
import cl.moncopulli.app.ui.theme.Urgente
import java.time.LocalDate

@Composable
fun RegistrarScreen(
    modifier: Modifier = Modifier,
    viewModel: RegistrarViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    var eligiendoMedicamento by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(ui.aviso) {
        ui.aviso?.let {
            snackbar.showSnackbar(it)
            viewModel.avisoMostrado()
        }
    }

    Box(modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()   // el teclado no tapa los últimos campos
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "Aplicación en terreno: crea el tratamiento y descuenta el stock en un solo paso.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            ui.errorCatalogos?.let {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(it, color = Urgente, modifier = Modifier.weight(1f))
                    TextButton(onClick = viewModel::reintentarCatalogos) { Text("Reintentar") }
                }
            }

            val habilitado = !ui.enviando

            // DIIO, con la ficha del animal debajo si lo encuentra.
            OutlinedTextField(
                value = ui.diio,
                onValueChange = viewModel::cambiarDiio,
                label = { Text("DIIO") },
                singleLine = true,
                enabled = habilitado,
                supportingText = { InfoAnimal(ui) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(),
            )

            CampoMedicamento(
                medicamento = ui.medicamento,
                hoy = ui.hoy,
                cargando = ui.cargandoCatalogos,
                enabled = habilitado && !ui.cargandoCatalogos,
                onClick = { eligiendoMedicamento = true },
            )

            OutlinedTextField(
                value = ui.cantidad,
                onValueChange = viewModel::cambiarCantidad,
                label = { Text("Cantidad") },
                suffix = { ui.medicamento?.let { Text(unidadCorta(it.unidad)) } },
                singleLine = true,
                enabled = habilitado,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(),
            )

            OutlinedTextField(
                value = ui.indicadoPor,
                onValueChange = viewModel::cambiarIndicadoPor,
                label = { Text("Indicado por (quién prescribe)") },
                singleLine = true,
                enabled = habilitado,
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.Words,
                    imeAction = ImeAction.Next,
                ),
                modifier = Modifier.fillMaxWidth(),
            )

            CampoFechaHora(valor = ui.fecha, onCambio = viewModel::cambiarFecha, enabled = habilitado)

            OutlinedTextField(
                value = ui.motivo,
                onValueChange = viewModel::cambiarMotivo,
                label = { Text("Motivo (opcional)") },
                supportingText = { Text("${ui.motivo.length}/$MAX_MOTIVO") },
                enabled = habilitado,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.fillMaxWidth(),
            )

            OutlinedTextField(
                value = ui.observaciones,
                onValueChange = viewModel::cambiarObservaciones,
                label = { Text("Observaciones (opcional)") },
                minLines = 2,
                enabled = habilitado,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.fillMaxWidth(),
            )

            ui.error?.let { Text(it, color = Urgente) }

            Button(
                onClick = viewModel::registrar,
                enabled = habilitado,
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (ui.enviando) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                else Text(if (ui.error != null) "Reintentar" else "Registrar aplicación")
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter))
    }

    if (eligiendoMedicamento) {
        DialogoMedicamentos(
            medicamentos = ui.medicamentos,
            hoy = ui.hoy,
            onElegir = {
                viewModel.elegirMedicamento(it)
                eligiendoMedicamento = false
            },
            onCancelar = { eligiendoMedicamento = false },
        )
    }
}

/** Debajo del DIIO: categoría y resguardo si el animal está en la lista; aviso si no aparece. */
@Composable
private fun InfoAnimal(ui: RegistrarUi) {
    if (ui.diio.length < 9) {
        Text("${ui.diio.length}/9 dígitos")
        return
    }
    val a = ui.animal
    when {
        a != null -> Column {
            val estado = a.estadoProductivo?.let { " · ${etiquetaEstadoProductivo(it)}" } ?: ""
            Text(etiquetaCategoria(a.categoria) + estado)
            a.resguardoHasta?.let {
                Text("Ya tiene resguardo de leche hasta ${fechaHoraCortaChile(it)}", color = Advertencia)
            }
        }
        // Solo es un aviso: el servidor es quien valida (la lista puede no estar cargada).
        !ui.cargandoCatalogos && ui.errorCatalogos == null ->
            Text("No se encontró un animal vigente con ese DIIO.", color = Advertencia)
        else -> Unit
    }
}

@Composable
private fun CampoMedicamento(
    medicamento: MedicamentoStock?,
    hoy: LocalDate,
    cargando: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    OutlinedCard(onClick = onClick, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    "Medicamento",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                when {
                    medicamento != null -> {
                        Text(medicamento.nombre, style = MaterialTheme.typography.bodyLarge)
                        Text(
                            "Stock vigente: ${cantidadConUnidad(medicamento.stockVigente(hoy), medicamento.unidad)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    cargando -> Text("Cargando…", style = MaterialTheme.typography.bodyLarge)
                    else -> Text("Elegir", style = MaterialTheme.typography.bodyLarge)
                }
            }
            if (cargando) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
        }
    }
}

@Composable
private fun DialogoMedicamentos(
    medicamentos: List<MedicamentoStock>,
    hoy: LocalDate,
    onElegir: (Long) -> Unit,
    onCancelar: () -> Unit,
) {
    var busqueda by rememberSaveable { mutableStateOf("") }
    val q = busqueda.trim().lowercase(LOCALE_CHILE)
    val visibles = medicamentos.filter { m ->
        q.isEmpty() ||
            m.nombre.lowercase(LOCALE_CHILE).contains(q) ||
            m.principioActivo?.lowercase(LOCALE_CHILE)?.contains(q) == true
    }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("Medicamento") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = busqueda,
                    onValueChange = { busqueda = it },
                    label = { Text("Buscar") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (visibles.isEmpty()) {
                    Text(
                        if (medicamentos.isEmpty()) "No hay medicamentos con stock vigente." else "Sin resultados.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                // AlertDialog no limita la altura de su contenido: la lista necesita un máximo.
                LazyColumn(Modifier.heightIn(max = 360.dp)) {
                    items(visibles, key = { it.id }) { m ->
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .clickable { onElegir(m.id) }
                                .padding(vertical = 12.dp),
                        ) {
                            Text(m.nombre, style = MaterialTheme.typography.bodyLarge)
                            Text(
                                listOfNotNull(
                                    m.principioActivo,
                                    "stock vigente ${cantidadConUnidad(m.stockVigente(hoy), m.unidad)}",
                                ).joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        HorizontalDivider()
                    }
                }
                Text(
                    "Solo aparecen medicamentos con stock en lotes no vencidos.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onCancelar) { Text("Cancelar") } },
    )
}

private fun unidadCorta(unidad: String): String = when (unidad) {
    "ML" -> "ml"
    "G" -> "g"
    "UNIDAD" -> "unid."
    else -> unidad.lowercase()
}
