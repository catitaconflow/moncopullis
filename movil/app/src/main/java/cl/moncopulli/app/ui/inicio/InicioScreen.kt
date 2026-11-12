package cl.moncopulli.app.ui.inicio

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import cl.moncopulli.app.ui.comun.PantallaProximamente

/** Marcador hasta la consulta de dosis de hoy (siguiente paso de la 4.2). */
@Composable
fun InicioScreen(nombre: String, modifier: Modifier = Modifier) {
    PantallaProximamente(
        titulo = "Hola, $nombre",
        detalle = "Aquí aparecerán las dosis programadas para hoy.",
        modifier = modifier,
    )
}