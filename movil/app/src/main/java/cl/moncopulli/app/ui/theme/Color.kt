package cl.moncopulli.app.ui.theme

import androidx.compose.ui.graphics.Color

// Paleta del panel (panel/src/index.css, modo claro). La app solo tiene modo claro.
val Fondo = Color(0xFFF4F2EC)            // --bg
val Superficie = Color(0xFFFFFFFF)       // --surface (tarjetas)
val Borde = Color(0xFFCFCBBE)            // --border
val Texto = Color(0xFF1A1C19)            // --text
val TextoSecundario = Color(0xFF55594F)  // --muted
val Principal = Color(0xFF1F5C3A)        // --accent
val PrincipalSuave = Color(0xFFE3F0E7)   // --accent-suave
val SobrePrincipal = Color(0xFFFFFFFF)   // --on-accent
// Verde claro para lo que va SOBRE el verde Principal (punto "En línea" del chip en la barra superior).
val PrincipalClaro = Color(0xFF8FD4A9)   // --accent del modo oscuro del panel

// Rojo SOLO para lo atrasado o urgente.
val Urgente = Color(0xFF9B2226)          // --danger
val UrgenteFondo = Color(0xFFFBE9E7)     // --danger-bg

// Stock bajo. No tiene un rol equivalente en el ColorScheme de Material 3: se usa directo.
val Advertencia = Color(0xFF8A5A00)      // --warn
val AdvertenciaFondo = Color(0xFFFFF4D6) // --warn-bg