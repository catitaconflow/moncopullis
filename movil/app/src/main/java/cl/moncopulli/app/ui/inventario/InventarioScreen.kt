package cl.moncopulli.app.ui.inventario

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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cl.moncopulli.app.data.inventario.DIAS_ALERTA_VENCIMIENTO
import cl.moncopulli.app.data.inventario.LoteStock
import cl.moncopulli.app.data.inventario.MedicamentoStock
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

    PullToRefreshBox(
        isRefreshing = ui.actualizando,
        onRefresh = viewModel::actualizar,
        modifier = modifier.fillMaxSize(),
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
                    items(visibles, key = { it.id }) { m -> TarjetaMedicamento(m, ui.hoy) }
                }
            }
        }
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
private fun TarjetaMedicamento(m: MedicamentoStock, hoy: LocalDate) {
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
