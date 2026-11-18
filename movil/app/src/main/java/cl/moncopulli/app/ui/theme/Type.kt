package cl.moncopulli.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import cl.moncopulli.app.R

/**
 * Nunito (Google Fonts, licencia OFL: movil/licencias/Nunito-OFL.txt), incluida en la app (res/font):
 * funciona sin internet. Solo dos pesos para no engordar el APK.
 */
private val Nunito = FontFamily(
    Font(R.font.nunito_semibold, FontWeight.SemiBold),
    Font(R.font.nunito_bold, FontWeight.Bold),
)

private val Base = Typography()

/**
 * Nunito en títulos, encabezados y etiquetas (botones, pestañas, insignias): da la personalidad de la marca.
 * El cuerpo de texto sigue con la fuente del sistema, que se lee mejor en párrafos y números largos.
 */
val Typography = Typography(
    displayLarge = Base.displayLarge.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    displayMedium = Base.displayMedium.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    displaySmall = Base.displaySmall.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    headlineLarge = Base.headlineLarge.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    headlineMedium = Base.headlineMedium.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    headlineSmall = Base.headlineSmall.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    titleLarge = Base.titleLarge.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    titleMedium = Base.titleMedium.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    titleSmall = Base.titleSmall.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    labelLarge = Base.labelLarge.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    labelMedium = Base.labelMedium.copy(fontFamily = Nunito, fontWeight = FontWeight.Bold),
    labelSmall = Base.labelSmall.copy(fontFamily = Nunito, fontWeight = FontWeight.SemiBold),
)
