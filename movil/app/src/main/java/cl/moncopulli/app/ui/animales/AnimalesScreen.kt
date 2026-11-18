package cl.moncopulli.app.ui.animales

import androidx.compose.foundation.background
import cl.moncopulli.app.R
import cl.moncopulli.app.ui.comun.CampoBusqueda
import cl.moncopulli.app.ui.comun.IconoCirculo
import cl.moncopulli.app.ui.comun.TarjetaMonco
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cl.moncopulli.app.data.animal.AnimalResumen
import cl.moncopulli.app.ui.comun.AvisoLista
import cl.moncopulli.app.ui.comun.etiquetaCategoria
import cl.moncopulli.app.ui.comun.etiquetaEstadoProductivo
import cl.moncopulli.app.ui.comun.fechaCorta
import cl.moncopulli.app.ui.comun.fechaHoraCortaChile
import cl.moncopulli.app.ui.theme.Advertencia
import cl.moncopulli.app.ui.theme.AdvertenciaFondo

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnimalesScreen(
    modifier: Modifier = Modifier,
    viewModel: AnimalesViewModel = hiltViewModel(),
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
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item(key = "filtros") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    CampoBusqueda(
                        valor = ui.busqueda,
                        onCambio = viewModel::buscar,
                        sugerencia = "Buscar por DIIO",
                        teclado = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Search),
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        FilterChip(
                            selected = ui.soloResguardo,
                            onClick = viewModel::alternarResguardo,
                            label = { Text("En resguardo (${ui.totalEnResguardo})") },
                        )
                        Text(
                            "${visibles.size} de ${ui.animales.size}",
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
                ui.animales.isEmpty() -> item {
                    AvisoLista(
                        ui.error ?: "No hay animales registrados.",
                        onReintentar = if (ui.error != null) viewModel::actualizar else null,
                    )
                }
                else -> {
                    ui.error?.let { item { AvisoLista(it) } }
                    if (visibles.isEmpty()) item { AvisoLista("Ningún animal coincide con el filtro.") }
                    items(visibles, key = { it.id }) { a -> TarjetaAnimal(a, ui.enResguardo(a)) }
                }
            }
        }
    }
}

@Composable
internal fun TarjetaAnimal(a: AnimalResumen, enResguardo: Boolean) {
    val tipo = listOfNotNull(
        etiquetaCategoria(a.categoria),
        a.estadoProductivo?.let(::etiquetaEstadoProductivo),
    ).joinToString(" · ")

    TarjetaMonco {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconoCirculo(R.drawable.ic_animales, MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.secondaryContainer)
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(a.diio ?: "Sin DIIO", style = MaterialTheme.typography.titleLarge)
                Text(tipo, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        a.propietario?.let { Detalle("Propietario: $it") }
        a.fechaNacimiento?.let { Detalle("Nacimiento: ${fechaCorta(it)}") }
        a.observaciones?.let { Detalle(it) }
        if (enResguardo && a.resguardoHasta != null) {
            Text(
                "No entregar leche hasta ${fechaHoraCortaChile(a.resguardoHasta)}",
                style = MaterialTheme.typography.labelLarge,
                color = Advertencia,
                modifier = Modifier
                    .padding(top = 8.dp)
                    .fillMaxWidth()
                    .background(AdvertenciaFondo, MaterialTheme.shapes.small)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun Detalle(texto: String) {
    Text(
        texto,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}