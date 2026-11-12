package cl.moncopulli.app.ui.inicio

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import cl.moncopulli.app.data.auth.Perfil

@Composable
fun InicioScreen(
    perfil: Perfil,
    onCerrarSesion: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize().padding(24.dp)) {
        Text("Hola, ${perfil.nombres}", style = MaterialTheme.typography.titleLarge)
        Text("Rol: ${perfil.rol}", modifier = Modifier.padding(top = 8.dp))
        Text(
            "Pantalla temporal: aquí irán las dosis y los registros.",
            modifier = Modifier.padding(top = 8.dp),
        )
        OutlinedButton(onClick = onCerrarSesion, modifier = Modifier.padding(top = 24.dp)) {
            Text("Cerrar sesión")
        }
    }
}