package cl.moncopulli.app.ui.comun

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Texto de estado dentro de una lista (vacía, error o datos de la caché). Con [onReintentar] muestra
 * un botón: deslizar hacia abajo también recarga, pero no todos lo saben y con la lista vacía no hay
 * otra pista de qué hacer.
 */
@Composable
fun AvisoLista(texto: String, modifier: Modifier = Modifier, onReintentar: (() -> Unit)? = null) {
    Column(modifier.padding(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            texto,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        onReintentar?.let { OutlinedButton(onClick = it) { Text("Reintentar") } }
    }
}
