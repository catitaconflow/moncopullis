package cl.moncopulli.app.ui.navegacion

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.LocalContentColor
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
import cl.moncopulli.app.ui.theme.PrincipalClaro

/**
 * Chip de la TopAppBar (verde). El punto indica la red (verde claro = en línea, tenue = sin conexión) y el texto
 * muestra los pendientes si hay ("3 por enviar"). Tocarlo lleva a Actividad.
 * Sin rojo ni ámbar: estar sin red es normal en terreno, no es urgente.
 * Texto y borde toman el color de contenido de la barra (LocalContentColor = blanco), así el chip
 * sigue viéndose si la barra cambia de color.
 */
@Composable
fun ChipConexion(enLinea: Boolean, pendientes: Int, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val red = if (enLinea) "En línea" else "Sin conexión"
    val texto = if (pendientes > 0) "$pendientes por enviar" else red
    val descripcion = if (pendientes > 0) "$red. $pendientes por enviar" else red
    val contenido = LocalContentColor.current
    val punto = if (enLinea) PrincipalClaro else contenido.copy(alpha = 0.5f)
    Row(
        modifier = modifier
            .clip(CircleShape)
            .clickable(onClickLabel = "Ver actividad", onClick = onClick)
            .border(1.dp, contenido.copy(alpha = 0.6f), CircleShape)
            .padding(horizontal = 10.dp, vertical = 4.dp)
            // TalkBack anuncia el cambio sin que el usuario tenga que tocar el chip.
            .semantics(mergeDescendants = true) {
                liveRegion = LiveRegionMode.Polite
                contentDescription = descripcion
            },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(8.dp).background(punto, CircleShape))
        Spacer(Modifier.width(6.dp))
        Text(texto, style = MaterialTheme.typography.labelMedium)
    }
}
