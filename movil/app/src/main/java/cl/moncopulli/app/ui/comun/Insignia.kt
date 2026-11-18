package cl.moncopulli.app.ui.comun

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** Pastilla de estado (Atrasada, Bajo mínimo, Vence en N días…), totalmente redondeada. */
@Composable
fun Insignia(texto: String, color: Color, fondo: Color, modifier: Modifier = Modifier) {
    Text(
        texto,
        style = MaterialTheme.typography.labelMedium,
        color = color,
        modifier = modifier
            .background(fondo, CircleShape)
            .padding(horizontal = 10.dp, vertical = 3.dp),
    )
}
