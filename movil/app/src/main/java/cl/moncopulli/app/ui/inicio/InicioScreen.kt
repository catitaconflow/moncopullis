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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cl.moncopulli.app.data.ZONA_CHILE
import cl.moncopulli.app.data.dosis.DosisDelDia
import cl.moncopulli.app.ui.comun.cantidadConUnidad
import cl.moncopulli.app.ui.comun.diaCortoChile
import cl.moncopulli.app.ui.comun.etiquetaCategoria
import cl.moncopulli.app.ui.comun.fechaLarga
import cl.moncopulli.app.ui.comun.horaChile
import cl.moncopulli.app.ui.theme.Urgente
import cl.moncopulli.app.ui.theme.UrgenteFondo
import java.time.LocalDate
import java.time.OffsetDateTime

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
                    Aviso(ui.error ?: "No hay dosis programadas para hoy.")
                }
                else -> {
                    ui.error?.let { item { Aviso(it) } }
                    items(ui.dosis, key = { it.id }) { d -> TarjetaDosis(d, ahora, hoy) }
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
private fun TarjetaDosis(d: DosisDelDia, ahora: OffsetDateTime, hoy: LocalDate) {
    val atrasada = d.fechaProgramada.isBefore(ahora)   // misma regla que el servidor (0005)
    val esDeHoy = d.fechaProgramada.atZoneSameInstant(ZONA_CHILE).toLocalDate() == hoy

    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.outlinedCardColors(
            containerColor = if (atrasada) UrgenteFondo else MaterialTheme.colorScheme.surface,
        ),
        border = BorderStroke(1.dp, if (atrasada) Urgente else MaterialTheme.colorScheme.outline),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
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
    }
}