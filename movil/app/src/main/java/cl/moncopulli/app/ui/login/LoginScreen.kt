package cl.moncopulli.app.ui.login

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.ui.graphics.Brush
import cl.moncopulli.app.ui.comun.TarjetaMonco
import cl.moncopulli.app.ui.comun.formaCampo
import cl.moncopulli.app.ui.theme.Principal
import cl.moncopulli.app.ui.theme.PrincipalOscuro
import cl.moncopulli.app.ui.theme.SobrePrincipal
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import cl.moncopulli.app.R
import cl.moncopulli.app.ui.sesion.LoginUi

@Composable
fun LoginScreen(
    ui: LoginUi,
    onIniciar: (correo: String, clave: String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var correo by rememberSaveable { mutableStateOf("") }
    // La contraseña va en remember (no rememberSaveable): no debe quedar en el estado guardado de la Activity.
    var clave by remember { mutableStateOf("") }
    val enviar = { onIniciar(correo, clave) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .imePadding()
            .verticalScroll(rememberScrollState()),
    ) {
        // Encabezado verde con el logo (rediseño).
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(listOf(Principal, PrincipalOscuro)),
                    RoundedCornerShape(bottomStart = 32.dp, bottomEnd = 32.dp),
                )
                .statusBarsPadding()
                .padding(top = 40.dp, bottom = 48.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            LogoMoncopulli(Modifier.padding(bottom = 16.dp))
            Text("Moncopulli", style = MaterialTheme.typography.headlineLarge, color = SobrePrincipal)
            Text(
                "Medicamentos y tratamientos en terreno",
                style = MaterialTheme.typography.bodyMedium,
                color = SobrePrincipal.copy(alpha = 0.85f),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        TarjetaMonco(Modifier.padding(horizontal = 20.dp).offset(y = (-24).dp)) {
            Text("Iniciar sesión", style = MaterialTheme.typography.titleLarge)
            Text(
                "Usa la misma cuenta del panel web.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            OutlinedTextField(
                value = correo,
                onValueChange = { correo = it },
                label = { Text("Correo") },
                singleLine = true,
                enabled = !ui.enviando,
                shape = formaCampo,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = clave,
                onValueChange = { clave = it },
                label = { Text("Contraseña") },
                singleLine = true,
                enabled = !ui.enviando,
                shape = formaCampo,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { enviar() }),
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
            ui.mensaje?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier
                        .padding(top = 12.dp)
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.errorContainer, MaterialTheme.shapes.small)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
            Button(
                onClick = { enviar() },
                enabled = !ui.enviando,
                modifier = Modifier.fillMaxWidth().padding(top = 20.dp).height(52.dp),
            ) {
                if (ui.enviando) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = SobrePrincipal)
                } else {
                    Text("Entrar")
                }
            }
        }
        Text(
            "Agrícola Moncopulli · Puyehue",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
        )
    }
}

/** Logo de la app: la vaca blanca sobre el verde Principal, igual que el ícono del lanzador. */
@Composable
private fun LogoMoncopulli(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(80.dp)
            // Esquinas más redondeadas que el resto de la app (6 dp) a propósito: imita el ícono del lanzador.
            .background(SobrePrincipal.copy(alpha = 0.14f), RoundedCornerShape(24.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Image(
            painter = painterResource(R.drawable.logo_moncopulli),
            // Decorativo: "Moncopulli" está justo debajo; así TalkBack no lo lee dos veces.
            contentDescription = null,
            modifier = Modifier.width(56.dp).aspectRatio(1020.5f / 831.5f),
        )
    }
}
