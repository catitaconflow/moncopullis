package cl.moncopulli.app.ui.animales

import androidx.compose.foundation.background
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
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item(key = "filtros") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = ui.busqueda,
                        onValueChange = viewModel::buscar,
                        label = { Text("Buscar por DIIO") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number,
                            imeAction = ImeAction.Search,
                        ),
                        modifier = Modifier.fillMaxWidth(),
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
                ui.animales.isEmpty() -> item { Aviso(ui.error ?: "No hay animales registrados.") }
                else -> {
                    ui.error?.let { item { Aviso(it) } }
                    if (visibles.isEmpty()) item { Aviso("Ningún animal coincide con el filtro.") }
                    items(visibles, key = { it.id }) { a -> TarjetaAnimal(a, ui.enResguardo(a)) }
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
private fun TarjetaAnimal(a: AnimalResumen, enResguardo: Boolean) {
    val tipo = listOfNotNull(
        etiquetaCategoria(a.categoria),
        a.estadoProductivo?.let(::etiquetaEstadoProductivo),
    ).joinToString(" · ")

    OutlinedCard(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    a.diio ?: "Sin DIIO",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                Text(tipo, style = MaterialTheme.typography.bodyMedium)
            }
            a.propietario?.let { Detalle("Propietario: $it") }
            a.fechaNacimiento?.let { Detalle("Nacimiento: ${fechaCorta(it)}") }
            a.observaciones?.let { Detalle(it) }
            if (enResguardo && a.resguardoHasta != null) {
                Text(
                    "No entregar leche hasta ${fechaHoraCortaChile(a.resguardoHasta)}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = Advertencia,
                    modifier = Modifier
                        .padding(top = 6.dp)
                        .fillMaxWidth()
                        .background(AdvertenciaFondo, MaterialTheme.shapes.small)
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                )
            }
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