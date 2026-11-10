package cl.moncopulli.app.ui.prueba

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import cl.moncopulli.app.BuildConfig
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.exceptions.RestException
import java.util.Base64
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class PruebaConexionViewModel @Inject constructor(
    private val supabase: SupabaseClient
) : ViewModel() {

    private val _lineas = MutableStateFlow<List<String>>(emptyList())
    val lineas: StateFlow<List<String>> = _lineas.asStateFlow()

    init {
        verificar()
    }

    private fun agregar(linea: String) = _lineas.update { it + linea }

    private fun verificar() {
        // 1) Formato de la URL (no se muestra la URL en pantalla)
        val urlOk = Regex("^https://[a-z0-9-]+\\.supabase\\.co/?$").matches(BuildConfig.SUPABASE_URL)
        agregar(
            if (urlOk) "URL: formato correcto"
            else "URL: formato inesperado (¿dominio propio o error de copia?)"
        )

        // 2) Tipo de clave (nunca se muestra la clave)
        agregar("Clave: " + tipoDeClave(BuildConfig.SUPABASE_ANON_KEY))

        // 3) Sondeo al servidor: login fallido a propósito
        viewModelScope.launch {
            try {
                supabase.auth.signInWith(Email) {
                    email = "prueba-conexion@example.com"
                    password = "contraseña-incorrecta-123"
                }
                agregar("Servidor: respuesta inesperada (el login no debía funcionar)")
            } catch (e: RestException) {
                when (val codigo = e.response.status.value) {
                    400 -> agregar("Servidor: 400 credenciales inválidas (lo esperado)")
                    401, 403 -> agregar("Servidor: $codigo clave rechazada (revisa SUPABASE_ANON_KEY)")
                    429 -> agregar("Servidor: 429 demasiados intentos, espera un minuto")
                    else -> agregar("Servidor: respondió $codigo")
                }
            } catch (e: CancellationException) {
                throw e // nunca tragarse la cancelación de una corrutina
            } catch (e: Exception) {
                agregar("Servidor: sin conexión (${e::class.simpleName})")
            }
        }
    }

    private fun tipoDeClave(clave: String): String = when {
        clave.isBlank() -> "VACÍA (revisa movil/local.properties)"
        clave.startsWith("sb_secret_") -> "¡¡ES UNA CLAVE SECRETA!! Quítala de la app ya"
        clave.startsWith("sb_publishable_") -> "publicable (correcta)"
        clave.startsWith("eyJ") -> rolDelJwt(clave)
        else -> "formato desconocido"
    }

    // Las claves antiguas son JWT: la parte central (payload) en Base64 contiene "role".
    private fun rolDelJwt(jwt: String): String {
        return try {
            val payload = jwt.split(".")[1]
            val json = String(Base64.getUrlDecoder().decode(payload))
            val rol = Regex("\"role\"\\s*:\\s*\"([^\"]+)\"").find(json)?.groupValues?.get(1)
            when (rol) {
                "anon" -> "anon (correcta)"
                "service_role" -> "¡¡ES service_role!! Quítala de la app ya"
                else -> "JWT con rol desconocido"
            }
        } catch (e: Exception) {
            "JWT ilegible"
        }
    }
}

@Composable
fun PruebaConexionScreen(
    viewModel: PruebaConexionViewModel,
    modifier: Modifier = Modifier
) {
    val lineas by viewModel.lineas.collectAsStateWithLifecycle()
    Column(modifier = modifier.padding(16.dp)) {
        Text("Prueba de conexión", style = MaterialTheme.typography.titleLarge)
        lineas.forEach { Text(it, modifier = Modifier.padding(top = 8.dp)) }
    }
}