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
    onPrimaryContainer = PrincipalOscuro,
    secondary = Principal,
    onSecondary = SobrePrincipal,
    secondaryContainer = PrincipalSuave,   // indicador de la pestaña activa y chips seleccionados
    onSecondaryContainer = PrincipalOscuro,
    tertiary = Info,
    onTertiary = SobrePrincipal,
    tertiaryContainer = InfoFondo,
    onTertiaryContainer = Info,
    background = Fondo,
    onBackground = Texto,
    surface = Superficie,
    onSurface = Texto,
    surfaceVariant = SuperficieSuave,
    onSurfaceVariant = TextoSecundario,
    surfaceTint = Superficie,              // sin tinte verde en superficies elevadas
    surfaceBright = Superficie,
    surfaceDim = Fondo,
    surfaceContainerLowest = Superficie,
    surfaceContainerLow = Superficie,
    surfaceContainer = Superficie,
    surfaceContainerHigh = Superficie,     // diálogos y menús en blanco
    surfaceContainerHighest = SuperficieSuave,
    outline = Borde,
    outlineVariant = Borde,
    error = Urgente,
    onError = SobrePrincipal,
    errorContainer = UrgenteFondo,
    onErrorContainer = Urgente,
)

// Esquinas más redondeadas que la v1 (6 dp): aspecto actual y más amable para uso en terreno.
private val Formas = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(10.dp),     // campos de texto, insignias
    medium = RoundedCornerShape(16.dp),    // tarjetas
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp), // diálogos
)

/** Tema único: solo modo claro y sin dynamicColor (colores del fondo de pantalla del teléfono). */
@Composable
fun MoncopulliTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = EsquemaClaro,
        typography = Typography,
        shapes = Formas,
        content = content,
    )
}
