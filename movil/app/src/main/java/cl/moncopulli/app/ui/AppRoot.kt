package cl.moncopulli.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cl.moncopulli.app.ui.login.LoginScreen
import cl.moncopulli.app.ui.navegacion.AppPrincipal
import cl.moncopulli.app.ui.sesion.EstadoSesion
import cl.moncopulli.app.ui.sesion.SesionViewModel

@Composable
fun AppRoot(
    modifier: Modifier = Modifier,
    viewModel: SesionViewModel = hiltViewModel(),
) {
    val estado by viewModel.estado.collectAsStateWithLifecycle()
    val login by viewModel.login.collectAsStateWithLifecycle()
    // Las pantallas sin Scaffold propio esquivan las barras del sistema y el teclado.
    val sinBarras = modifier.safeDrawingPadding()

    when (val e = estado) {
        EstadoSesion.Cargando, EstadoSesion.Verificando -> PantallaCargando(sinBarras)
        EstadoSesion.SinSesion -> LoginScreen(login, viewModel::iniciarSesion, modifier.navigationBarsPadding())
        is EstadoSesion.Autorizado -> AppPrincipal(e.perfil, viewModel::cerrarSesion, modifier)
        is EstadoSesion.ErrorConexion ->
            PantallaError(e.mensaje, viewModel::reintentar, viewModel::cerrarSesion, sinBarras)
    }
}

@Composable
private fun PantallaCargando(modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

@Composable
private fun PantallaError(
    mensaje: String,
    onReintentar: () -> Unit,
    onCerrarSesion: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(mensaje)
        Button(onClick = onReintentar, modifier = Modifier.padding(top = 16.dp)) { Text("Reintentar") }
        OutlinedButton(onClick = onCerrarSesion, modifier = Modifier.padding(top = 8.dp)) {
            Text("Cerrar sesión")
        }
    }
}