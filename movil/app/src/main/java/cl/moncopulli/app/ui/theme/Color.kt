package cl.moncopulli.app.ui.theme

import androidx.compose.ui.graphics.Color

// Paleta v2 (rediseño 2026-11). Mantiene el verde del panel como color de marca, con neutros más limpios
// y superficies blancas sobre un fondo gris verdoso muy claro. La app solo tiene modo claro.
val Fondo = Color(0xFFF3F5F1)            // fondo de pantalla
val Superficie = Color(0xFFFFFFFF)       // tarjetas
val SuperficieSuave = Color(0xFFEDF1EA)  // campos de búsqueda, filas secundarias
val Borde = Color(0xFFDCE2D6)            // bordes sutiles
val Texto = Color(0xFF17201A)
val TextoSecundario = Color(0xFF5E6A60)
val Principal = Color(0xFF1F5C3A)        // verde Moncopulli (panel --accent)
val PrincipalOscuro = Color(0xFF15432A)  // degradado del encabezado
val PrincipalSuave = Color(0xFFDDEFE3)   // indicador de pestaña, fondos de acento
val SobrePrincipal = Color(0xFFFFFFFF)
// Verde claro para lo que va SOBRE el verde Principal (punto "En línea").
val PrincipalClaro = Color(0xFF8FD4A9)

// Rojo SOLO para lo atrasado o urgente.
val Urgente = Color(0xFFB3261E)
val UrgenteFondo = Color(0xFFFCEAE8)

// Stock bajo y resguardo de leche.
val Advertencia = Color(0xFF8A5A00)
val AdvertenciaFondo = Color(0xFFFFF1CF)

// Información neutra (por enviar, programada).
val Info = Color(0xFF285D8F)
val InfoFondo = Color(0xFFE4EEF8)
