package cl.moncopulli.app.ui.navegacion

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import cl.moncopulli.app.ui.theme.Info
import cl.moncopulli.app.ui.theme.InfoFondo

/**
 * Pastilla de conexión de la barra superior. Verde = en línea; gris = sin conexión; azul = hay registros
 * esperando envío ("3 por enviar"). Tocarla lleva a Actividad. Sin rojo: estar sin red es normal en terreno.
 */
@Composable
fun ChipConexion(enLinea: Boolean, pendientes: Int, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val red = if (enLinea) "En línea" else "Sin conexión"
    val texto = if (pendientes > 0) "$pendientes por enviar" else red
    val descripcion = if (pendientes > 0) "$red. $pendientes por enviar" else red
    val (fondo, color) = when {
        pendientes > 0 -> InfoFondo to Info
        enLinea -> MaterialTheme.colorScheme.secondaryContainer to MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Row(
        modifier = modifier
            .clip(CircleShape)
            .background(fondo)
            .clickable(onClickLabel = "Ver actividad", onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp)
            // TalkBack anuncia el cambio sin que el usuario tenga que tocar la pastilla.
            .semantics(mergeDescendants = true) {
                liveRegion = LiveRegionMode.Polite
                contentDescription = descripcion
            },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(8.dp).background(color, CircleShape))
        Spacer(Modifier.width(6.dp))
        Text(texto, style = MaterialTheme.typography.labelMedium, color = color)
    }
}
