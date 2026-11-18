package cl.moncopulli.app.ui.comun

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * Estado dentro de una lista (vacía, error o datos de la caché), centrado y con aire. Con [onReintentar]
 * muestra un botón: deslizar hacia abajo también recarga, pero no todos lo saben.
 */
@Composable
fun AvisoLista(texto: String, modifier: Modifier = Modifier, onReintentar: (() -> Unit)? = null) {
    Column(
        modifier.fillMaxWidth().padding(vertical = 24.dp, horizontal = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            texto,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        onReintentar?.let { FilledTonalButton(onClick = it) { Text("Reintentar") } }
    }
}
