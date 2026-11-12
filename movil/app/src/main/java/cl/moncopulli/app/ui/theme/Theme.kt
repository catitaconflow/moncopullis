package cl.moncopulli.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

private val EsquemaClaro = lightColorScheme(
    primary = Principal,
    onPrimary = SobrePrincipal,
    primaryContainer = PrincipalSuave,
    onPrimaryContainer = Principal,
    secondary = Principal,
    onSecondary = SobrePrincipal,
    secondaryContainer = PrincipalSuave,   // indicador de la pestaña activa
    onSecondaryContainer = Principal,
    tertiary = Principal,
    onTertiary = SobrePrincipal,
    background = Fondo,
    onBackground = Texto,
    surface = Superficie,
    onSurface = Texto,
    surfaceVariant = Fondo,
    onSurfaceVariant = TextoSecundario,
    surfaceTint = Superficie,              // sin tinte verde en superficies elevadas
    surfaceBright = Superficie,
    surfaceDim = Fondo,
    surfaceContainerLowest = Superficie,
    surfaceContainerLow = Superficie,
    surfaceContainer = Superficie,
    surfaceContainerHigh = Superficie,
    surfaceContainerHighest = Superficie,
    outline = Borde,
    outlineVariant = Borde,                // borde de OutlinedCard y divisores
    error = Urgente,
    onError = SobrePrincipal,
    errorContainer = UrgenteFondo,
    onErrorContainer = Urgente,
)

// Radio de 6 dp como el panel. extraLarge (diálogos) queda con el valor por defecto.
private val Radio = RoundedCornerShape(6.dp)
private val Formas = Shapes(extraSmall = Radio, small = Radio, medium = Radio, large = Radio)

/** Tema único: solo modo claro y sin dynamicColor (colores del fondo de pantalla del teléfono). */
@Composable
fun MoncopulliTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = EsquemaClaro,
        typography = Typography,   // Type.kt: fuente del sistema, no se toca
        shapes = Formas,
        content = content,
    )
}