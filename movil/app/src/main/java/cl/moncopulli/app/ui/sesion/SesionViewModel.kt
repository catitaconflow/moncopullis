package cl.moncopulli.app.ui.sesion

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cl.moncopulli.app.data.auth.Perfil
import cl.moncopulli.app.data.auth.Roles
import cl.moncopulli.app.data.auth.SesionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.exceptions.RestException
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface EstadoSesion {
    data object Cargando : EstadoSesion      // leyendo la sesión guardada
    data object SinSesion : EstadoSesion     // mostrar el login
    data object Verificando : EstadoSesion   // hay sesión; leyendo perfil y rol
    data class Autorizado(val authId: String, val perfil: Perfil) : EstadoSesion
    data class ErrorConexion(val mensaje: String) : EstadoSesion
}

/** Estado del formulario de login: botón ocupado y mensaje (error de login o motivo de bloqueo). */
data class LoginUi(val enviando: Boolean = false, val mensaje: String? = null)

@HiltViewModel
class SesionViewModel @Inject constructor(
    private val repo: SesionRepository,
) : ViewModel() {

    private val _estado = MutableStateFlow<EstadoSesion>(EstadoSesion.Cargando)
    val estado: StateFlow<EstadoSesion> = _estado.asStateFlow()

    private val _login = MutableStateFlow(LoginUi())
    val login: StateFlow<LoginUi> = _login.asStateFlow()

    init {
        viewModelScope.launch {
            repo.estadoAuth.collectLatest { alCambiarSesion(it) }
        }
    }

    private suspend fun alCambiarSesion(status: SessionStatus) {
        when (status) {
            SessionStatus.Initializing -> _estado.value = EstadoSesion.Cargando
            is SessionStatus.NotAuthenticated -> _estado.value = EstadoSesion.SinSesion
            is SessionStatus.RefreshFailure ->
                _estado.value = EstadoSesion.ErrorConexion("No se pudo renovar tu sesión. Revisa tu conexión.")
            is SessionStatus.Authenticated -> {
                // Cada renovación del token vuelve a emitir Authenticated: no repetir la verificación.
                val actual = _estado.value
                if (actual is EstadoSesion.Autorizado && actual.authId == repo.usuarioActual()?.id) return
                verificar()
            }
        }
    }

    private suspend fun verificar() {
        val usuario = repo.usuarioActual()
        if (usuario == null) {
            _estado.value = EstadoSesion.SinSesion
            return
        }
        _estado.value = EstadoSesion.Verificando

        if (usuario.debeCambiarClave) {
            bloquear("Entraste con una contraseña temporal. Cámbiala en el panel web y vuelve a entrar aquí.")
            return
        }
        try {
            val perfil = repo.leerPerfil(usuario.id)
            when {
                perfil == null -> bloquear("Tu cuenta no tiene un perfil de usuario. Avisa a un administrador.")
                !perfil.activo -> bloquear("Tu cuenta está desactivada. Avisa a un administrador.")
                perfil.rol !in Roles.PERMITIDOS -> bloquear("Tu rol no tiene acceso a la app móvil.")
                else -> _estado.value = EstadoSesion.Autorizado(usuario.id, perfil)
            }
        } catch (e: CancellationException) {
            throw e // nunca tragarse la cancelación de una corrutina
        } catch (e: RestException) {
            if (e.response.status.value == 401) {
                bloquear("Tu sesión expiró. Inicia sesión de nuevo.")
            } else {
                _estado.value = EstadoSesion.ErrorConexion(
                    "No se pudo leer tu perfil (error ${e.response.status.value})."
                )
            }
        } catch (e: Exception) {
            _estado.value = EstadoSesion.ErrorConexion("Sin conexión con el servidor. Revisa tu internet.")
        }
    }

    /** Muestra el motivo en el login y cierra la sesión (emite NotAuthenticated → SinSesion). */
    private fun bloquear(mensaje: String) {
        _login.update { it.copy(enviando = false, mensaje = mensaje) }
        viewModelScope.launch { repo.cerrarSesion() }
    }

    fun iniciarSesion(correo: String, clave: String) {
        val c = correo.trim().lowercase()
        if (_login.value.enviando) return
        if (c.isEmpty() || clave.isEmpty()) {
            _login.value = LoginUi(mensaje = "Escribe tu correo y tu contraseña.")
            return
        }
        _login.value = LoginUi(enviando = true)
        viewModelScope.launch {
            try {
                repo.iniciarSesion(c, clave)
                // La verificación sigue sola por sessionStatus (Authenticated → verificar()).
                _login.update { it.copy(enviando = false) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: RestException) {
                _login.value = LoginUi(
                    mensaje = when (e.response.status.value) {
                        400, 401 -> "Correo o contraseña incorrectos."
                        429 -> "Demasiados intentos. Espera un minuto e inténtalo de nuevo."
                        else -> "No se pudo iniciar sesión (error ${e.response.status.value})."
                    }
                )
            } catch (e: Exception) {
                _login.value = LoginUi(mensaje = "Sin conexión con el servidor. Revisa tu internet.")
            }
        }
    }

    fun reintentar() {
        viewModelScope.launch { verificar() }
    }

    fun cerrarSesion() {
        _login.value = LoginUi()
        viewModelScope.launch { repo.cerrarSesion() }
    }
}