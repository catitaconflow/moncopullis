package cl.moncopulli.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import cl.moncopulli.app.R

/**
 * Nunito (Google Fonts, licencia OFL: movil/licencias/Nunito-OFL.txt), incluida en la app (res/font):
 * funciona sin internet. Solo dos pesos para no engordar el APK; si se pide otro peso, Compose usa el más cercano.
 */
private val Nunito = FontFamily(
    Font(R.font.nunito_semibold, FontWeight.SemiBold),
    Font(R.font.nunito_bold, FontWeight.Bold),
)

// Tamaños e interlineados por defecto de Material 3; solo cambian la fuente y el peso.
private val Base = Typography()

/**
 * Nunito solo en títulos y encabezados (personalidad); cuerpo y etiquetas con la fuente del sistema
 * (listas, formularios y números se leen igual que antes).
 */
val Typography = Typography(
    displayLarge = Base.displayLarge.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    displayMedium = Base.displayMedium.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    displaySmall = Base.displaySmall.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    headlineLarge = Base.headlineLarge.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),   // "Moncopulli" del Login
    headlineMedium = Base.headlineMedium.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    headlineSmall = Base.headlineSmall.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),   // títulos de diálogos
    titleLarge = Base.titleLarge.copy(fontFamily = Nunito, fontWeight = FontWeight.SemiBold),     // barra superior, fecha de Inicio
    titleMedium = Base.titleMedium.copy(fontFamily = Nunito, fontWeight = FontWeight.SemiBold),   // hora y DIIO de las tarjetas
    titleSmall = Base.titleSmall.copy(fontFamily = Nunito, fontWeight = FontWeight.SemiBold),
)
