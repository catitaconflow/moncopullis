package cl.moncopulli.app.ui.inicio

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.res.painterResource
import cl.moncopulli.app.R
import cl.moncopulli.app.ui.comun.Insignia
import cl.moncopulli.app.ui.comun.TarjetaMonco
import cl.moncopulli.app.ui.theme.Info
import cl.moncopulli.app.ui.theme.InfoFondo
import cl.moncopulli.app.ui.theme.Principal
import cl.moncopulli.app.ui.theme.PrincipalClaro
import cl.moncopulli.app.ui.theme.PrincipalOscuro
import cl.moncopulli.app.ui.theme.SobrePrincipal
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
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
    modifier: Modifier = Modifier,
    viewModel: InicioViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    // Se recalculan cada vez que llega una lista nueva.
    val ahora = remember(ui.dosis) { OffsetDateTime.now() }
    val hoy = remember(ui.dosis) { LocalDate.now(ZONA_CHILE) }
    val atrasadas = remember(ui.dosis, ahora) { ui.dosis.count { it.atrasada(ahora) } }
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
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    ResumenDia(
                        fecha = fechaLarga(hoy),
                        total = ui.dosis.size,
                        atrasadas = atrasadas,
                        cargando = ui.cargando,
                    )
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
                reintentable = ui.errorAccionReintentable,
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

/** Misma regla que el servidor (0005). La usan la tarjeta y el resumen, para que siempre coincidan. */
internal fun DosisDelDia.atrasada(ahora: OffsetDateTime) = fechaProgramada.isBefore(ahora)

/** "5 por aplicar · 2 atrasadas": el total incluye las atrasadas, que van en rojo. */
private fun resumenDosis(total: Int, atrasadas: Int): AnnotatedString = buildAnnotatedString {
    append("$total por aplicar")
    if (atrasadas > 0) {
        append(" · ")
        withStyle(SpanStyle(color = Urgente)) {
            append(if (atrasadas == 1) "1 atrasada" else "$atrasadas atrasadas")
        }
    }
}

/** Encabezado verde con la fecha y los contadores del día (rediseño). */
@Composable
internal fun ResumenDia(fecha: String, total: Int, atrasadas: Int, cargando: Boolean) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp)
            .clip(MaterialTheme.shapes.large)
            .background(Brush.linearGradient(listOf(Principal, PrincipalOscuro)))
            .padding(20.dp),
    ) {
        Text("Hoy", style = MaterialTheme.typography.labelLarge, color = PrincipalClaro)
        Text(
            fecha.replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.titleLarge,
            color = SobrePrincipal,
        )
        Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Contador(if (cargando) "–" else "$total", "por aplicar", Modifier.weight(1f))
            Contador(if (cargando) "–" else "$atrasadas", if (atrasadas == 1) "atrasada" else "atrasadas",
                Modifier.weight(1f), alerta = atrasadas > 0)
        }
    }
}

@Composable
private fun Contador(valor: String, etiqueta: String, modifier: Modifier = Modifier, alerta: Boolean = false) {
    Column(
        modifier
            .clip(MaterialTheme.shapes.medium)
            .background(if (alerta) UrgenteFondo else SobrePrincipal.copy(alpha = 0.12f))
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        Text(valor, style = MaterialTheme.typography.headlineMedium, color = if (alerta) Urgente else SobrePrincipal)
        Text(etiqueta, style = MaterialTheme.typography.labelMedium,
            color = if (alerta) Urgente else SobrePrincipal.copy(alpha = 0.85f), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/**
 * Tarjeta de dosis (rediseño, corrige DEF-02): arriba la pastilla de estado y la hora, abajo el DIIO y el
 * medicamento a TODO el ancho, en hasta dos líneas, así nunca compiten por espacio con la hora.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun TarjetaDosis(
    d: DosisDelDia,
    ahora: OffsetDateTime,
    hoy: LocalDate,
    habilitada: Boolean,
    puedeOmitir: Boolean,
    onAplicar: () -> Unit,
    onOmitir: () -> Unit,
) {
    val atrasada = d.atrasada(ahora)
    val esDeHoy = d.fechaProgramada.atZoneSameInstant(ZONA_CHILE).toLocalDate() == hoy
    val cuando = if (esDeHoy) horaChile(d.fechaProgramada)
    else "${diaCortoChile(d.fechaProgramada)} · ${horaChile(d.fechaProgramada)}"

    TarjetaMonco(acento = if (atrasada) Urgente else null) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            itemVerticalAlignment = Alignment.CenterVertically,
        ) {
            if (atrasada) Insignia("Atrasada", Urgente, UrgenteFondo)
            else Insignia(if (esDeHoy) "Hoy" else "Próxima", Info, InfoFondo)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    painterResource(R.drawable.ic_reloj), contentDescription = null,
                    tint = if (atrasada) Urgente else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp),
                )
                Text(
                    cuando,
                    style = MaterialTheme.typography.labelLarge,
                    color = if (atrasada) Urgente else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 4.dp),
                )
            }
        }
        Text(
            d.diio ?: "Sin DIIO",
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.padding(top = 6.dp),
        )
        Text(
            d.medicamento,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            "${cantidadConUnidad(d.cantidad, d.unidad)} · ${etiquetaCategoria(d.categoria)}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        // Con fuente muy grande los botones van uno sobre otro, a todo el ancho, para que no se corte el texto.
        val apilar = LocalDensity.current.fontScale >= 1.5f
        val omitir: @Composable (Modifier) -> Unit = { m ->
            OutlinedButton(onClick = onOmitir, enabled = habilitada && puedeOmitir, modifier = m) { Text("Omitir") }
        }
        val aplicar: @Composable (Modifier) -> Unit = { m ->
            Button(onClick = onAplicar, enabled = habilitada, modifier = m) { Text("Aplicar dosis") }
        }
        if (apilar) {
            Column(Modifier.fillMaxWidth().padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                aplicar(Modifier.fillMaxWidth())
                omitir(Modifier.fillMaxWidth())
            }
        } else {
            Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                omitir(Modifier.weight(1f))
                aplicar(Modifier.weight(1.4f))
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
    reintentable: Boolean,
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
                else Text(if (error != null && reintentable) "Reintentar" else "Aplicar")
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
