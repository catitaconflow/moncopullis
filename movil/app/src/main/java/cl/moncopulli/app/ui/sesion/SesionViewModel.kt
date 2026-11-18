package cl.moncopulli.app.ui.sesion

import android.util.Log
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
    /** [sinConexion] = el perfil salió del teléfono; se vuelve a verificar al renovar la sesión con red. */
    data class Autorizado(val authId: String, val perfil: Perfil, val sinConexion: Boolean = false) : EstadoSesion
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
        // Solo el nombre del estado: status.toString() incluiría la sesión con sus tokens.
        Log.i(TAG, "Estado de Auth: ${status::class.simpleName}; app: ${_estado.value::class.simpleName}")
        when (status) {
            SessionStatus.Initializing -> _estado.value = EstadoSesion.Cargando
            is SessionStatus.NotAuthenticated -> _estado.value = EstadoSesion.SinSesion
            // Token vencido y no se pudo renovar (normalmente, sin red). supabase-kt reintenta solo y
            // emite Authenticated cuando vuelve la red. Mientras tanto se sigue trabajando sin conexión.
            is SessionStatus.RefreshFailure -> {
                Log.i(TAG, "No se pudo renovar la sesión: ${status.cause}")
                if (_estado.value is EstadoSesion.Autorizado) return
                val g = repo.perfilGuardado()
                _estado.value = if (g != null && puedeEntrar(g.perfil)) {
                    EstadoSesion.Autorizado(g.authUserId, g.perfil, sinConexion = true)
                } else {
                    EstadoSesion.ErrorConexion("No se pudo renovar tu sesión. Revisa tu conexión.")
                }
            }
            is SessionStatus.Authenticated -> {
                // Cada renovación del token vuelve a emitir Authenticated: no repetir la verificación,
                // salvo que se haya entrado sin conexión (entonces se confirma el perfil en silencio).
                val actual = _estado.value
                if (actual is EstadoSesion.Autorizado && actual.authId == repo.usuarioActual()?.id) {
                    if (actual.sinConexion) verificar(silencioso = true)
                    return
                }
                verificar(silencioso = false)
            }
        }
    }

    private fun puedeEntrar(p: Perfil) = p.activo && p.rol in Roles.PERMITIDOS

    /**
     * Lee perfil y rol. [silencioso] = ya estaba dentro (sin conexión): no se muestra la pantalla de
     * carga (desmontaría la navegación) y un fallo de red no cambia nada; solo se bloquea si el
     * servidor confirma que ya no puede entrar.
     */
    private suspend fun verificar(silencioso: Boolean) {
        val usuario = repo.usuarioActual()
        if (usuario == null) {
            if (!silencioso) _estado.value = EstadoSesion.SinSesion
            return
        }
        if (!silencioso) _estado.value = EstadoSesion.Verificando

        if (usuario.debeCambiarClave) {
            bloquear("Entraste con una contraseña temporal. Cámbiala en el panel web y vuelve a entrar aquí.")
            return
        }
        try {
            val leido = repo.leerPerfil(usuario.id)
            val perfil = leido.perfil
            when {
                perfil == null -> bloquear("Tu cuenta no tiene un perfil de usuario. Avisa a un administrador.")
                !perfil.activo -> bloquear("Tu cuenta está desactivada. Avisa a un administrador.")
                perfil.rol !in Roles.PERMITIDOS -> bloquear("Tu rol no tiene acceso a la app móvil.")
                silencioso && leido.sinConexion -> Unit // sigue sin red: se queda como está
                else -> {
                    if (leido.sinConexion) Log.i(TAG, "Sin respuesta del servidor: entra con el perfil guardado")
                    _estado.value = EstadoSesion.Autorizado(usuario.id, perfil, sinConexion = leido.sinConexion)
                }
            }
        } catch (e: CancellationException) {
            throw e // nunca tragarse la cancelación de una corrutina
        } catch (e: RestException) {
            if (silencioso) return
            if (e.response.status.value == 401) {
                bloquear("Tu sesión expiró. Inicia sesión de nuevo.")
            } else {
                _estado.value = EstadoSesion.ErrorConexion(
                    "No se pudo leer tu perfil (error ${e.response.status.value})."
                )
            }
        } catch (e: Exception) {
            // Sin red y sin perfil guardado de esta cuenta (p. ej. primer ingreso en este teléfono).
            if (!silencioso) {
                _estado.value = EstadoSesion.ErrorConexion("Sin conexión con el servidor. Revisa tu internet.")
            }
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
        viewModelScope.launch { verificar(silencioso = false) }
    }

    /** Cierra sesión y borra pendientes y caché del teléfono (AppPrincipal confirma antes si hay pendientes). */
    fun cerrarSesion() {
        _login.value = LoginUi()
        viewModelScope.launch { repo.cerrarSesion() }
    }

    private companion object {
        const val TAG = "MoncopulliSesion"
    }
}
