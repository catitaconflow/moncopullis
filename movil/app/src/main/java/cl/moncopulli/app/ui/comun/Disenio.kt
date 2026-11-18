package cl.moncopulli.app.ui.comun

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.TextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import cl.moncopulli.app.R
import cl.moncopulli.app.ui.theme.Advertencia
import cl.moncopulli.app.ui.theme.Principal

/**
 * Tarjeta base del rediseño: blanca, esquinas de 16 dp, borde muy sutil y sombra baja.
 * [acento] dibuja un borde de color (rojo para lo atrasado o rechazado).
 */
@Composable
fun TarjetaMonco(
    modifier: Modifier = Modifier,
    acento: Color? = null,
    fondo: Color = MaterialTheme.colorScheme.surface,
    onClick: (() -> Unit)? = null,
    enabled: Boolean = true,
    contenido: @Composable ColumnScope.() -> Unit,
) {
    val borde = BorderStroke(if (acento != null) 1.5.dp else 1.dp, acento ?: MaterialTheme.colorScheme.outline)
    val colores = CardDefaults.cardColors(containerColor = fondo)
    val elevacion = CardDefaults.cardElevation(defaultElevation = 1.dp)
    val interior: @Composable ColumnScope.() -> Unit = {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp), content = contenido)
    }
    if (onClick != null) {
        Card(onClick = onClick, enabled = enabled, modifier = modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium,
            colors = colores, elevation = elevacion, border = borde, content = interior)
    } else {
        Card(modifier = modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium,
            colors = colores, elevation = elevacion, border = borde, content = interior)
    }
}

/** Título de sección dentro de una lista, con contador opcional en una pastilla. */
@Composable
fun EncabezadoSeccion(titulo: String, modifier: Modifier = Modifier, cantidad: Int? = null) {
    Row(modifier.padding(top = 12.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(titulo, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false))
        cantidad?.let {
            Insignia("$it", MaterialTheme.colorScheme.onSecondaryContainer, MaterialTheme.colorScheme.secondaryContainer,
                Modifier.padding(start = 8.dp))
        }
    }
}

/** Buscador con ícono, relleno suave y esquinas redondeadas (reemplaza al OutlinedTextField de la v1). */
@Composable
fun CampoBusqueda(
    valor: String,
    onCambio: (String) -> Unit,
    sugerencia: String,
    modifier: Modifier = Modifier,
    teclado: KeyboardOptions = KeyboardOptions.Default,
) {
    TextField(
        value = valor,
        onValueChange = onCambio,
        placeholder = { Text(sugerencia, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        leadingIcon = { Icon(painterResource(R.drawable.ic_buscar), contentDescription = null) },
        trailingIcon = if (valor.isNotEmpty()) {
            { IconButton(onClick = { onCambio("") }) { Text("✕", color = MaterialTheme.colorScheme.onSurfaceVariant) } }
        } else null,
        singleLine = true,
        keyboardOptions = teclado,
        shape = MaterialTheme.shapes.large,
        colors = TextFieldDefaults.colors(
            focusedContainerColor = MaterialTheme.colorScheme.surface,
            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            disabledIndicatorColor = Color.Transparent,
        ),
        modifier = modifier.fillMaxWidth(),
    )
}

/** Formas de los campos de formulario: mismas esquinas que el resto. */
val formaCampo @Composable get() = MaterialTheme.shapes.small

@Composable
fun coloresCampo() = OutlinedTextFieldDefaults.colors(
    unfocusedContainerColor = MaterialTheme.colorScheme.surface,
    focusedContainerColor = MaterialTheme.colorScheme.surface,
    disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
)

/**
 * Barra de stock: proporción del stock actual frente a 2× el mínimo (el mínimo queda a la mitad).
 * Ámbar si está bajo el mínimo, verde si no.
 */
@Composable
fun BarraStock(actual: Double, minimo: Double, modifier: Modifier = Modifier) {
    val tope = if (minimo > 0) minimo * 2 else maxOf(actual, 1.0)
    val fraccion = (actual / tope).coerceIn(0.0, 1.0).toFloat()
    val color = if (actual < minimo) Advertencia else Principal
    Box(
        modifier
            .fillMaxWidth()
            .height(8.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Box(Modifier.fillMaxWidth(fraccion).height(8.dp).clip(CircleShape).background(color))
        if (minimo > 0) {
            // Marca del mínimo
            Box(Modifier.fillMaxWidth(0.5f).height(8.dp), contentAlignment = Alignment.CenterEnd) {
                Box(Modifier.size(width = 2.dp, height = 8.dp).background(MaterialTheme.colorScheme.onSurfaceVariant))
            }
        }
    }
}

/** Ícono dentro de un círculo de color: encabeza tarjetas y avisos. */
@Composable
fun IconoCirculo(icono: Int, color: Color, fondo: Color, modifier: Modifier = Modifier) {
    Box(modifier.size(40.dp).background(fondo, CircleShape), contentAlignment = Alignment.Center) {
        Icon(painterResource(icono), contentDescription = null, tint = color, modifier = Modifier.size(22.dp))
    }
}
