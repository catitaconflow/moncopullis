package cl.moncopulli.app.data.envio

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import cl.moncopulli.app.data.CambiosDatos
import cl.moncopulli.app.data.dosis.DosisRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject

/**
 * Envía los pendientes del usuario con sesión, en orden. Lo programa [ProgramadorEnvios] con
 * restricción de red. Resultado: success si no queda nada que reintentar; retry si hubo un fallo
 * pasajero (WorkManager vuelve a llamarlo con espera creciente).
 */
@HiltWorker
class EnviarPendientesWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val supabase: SupabaseClient,
    private val dosisRepo: DosisRepository,
    private val dao: EnvioDao,
    private val cambios: CambiosDatos,
) : CoroutineWorker(context, params) {

    private enum class Paso { ENVIADO, RECHAZADO, DETENER }

    override suspend fun doWork(): Result {
        // El worker puede correr con la app cerrada: esperar a que Auth cargue la sesión guardada.
        supabase.auth.awaitInitialization()
        val uid = supabase.auth.currentSessionOrNull()?.user?.id
        if (uid == null) {
            Log.i(TAG, "Sin sesión cargada; se reintentará si hay pendientes")
            return if (dao.contarPendientes() > 0) Result.retry() else Result.success()
        }

        var terminados = 0
        var detener = false
        // Se vuelve a consultar al terminar una pasada: así salen también los que llegaron mientras tanto.
        while (!detener) {
            val lote = dao.pendientesDe(uid)
            if (lote.isEmpty()) break
            for (e in lote) {
                when (enviarUno(e)) {
                    Paso.ENVIADO, Paso.RECHAZADO -> terminados++
                    Paso.DETENER -> {
                        detener = true
                        break // sin red o servidor caído: no tiene sentido seguir con los demás
                    }
                }
            }
        }
        if (terminados > 0) cambios.avisar() // Inicio, Animales, Inventario y Registrar recargan
        return if (detener) Result.retry() else Result.success()
    }

    private suspend fun enviarUno(e: EnvioEntity): Paso {
        val ahora = System.currentTimeMillis()
        return try {
            val tipo = TipoEnvio.valueOf(e.tipo)
            val params = Json.parseToJsonElement(e.parametros).jsonObject
            val r = dosisRepo.llamarRpcApp(tipo.rpc, params)
            dao.marcarEnviado(e.id, r.lote, r.resguardoHasta?.toString(), ahora)
            Log.i(TAG, "Enviado ${e.tipo} ${e.id} (ya_registrado=${r.yaRegistrada})")
            Paso.ENVIADO
        } catch (ex: CancellationException) {
            throw ex // WorkManager detuvo el trabajo (p. ej. REPLACE): queda PENDIENTE y se reenvía
        } catch (ex: Exception) {
            when (val f = clasificarFallo(ex)) {
                is FalloEnvio.Rechazo -> {
                    Log.w(TAG, "Rechazado ${e.tipo} ${e.id}: ${f.mensaje}")
                    dao.marcarRechazado(e.id, f.mensaje, ahora)
                    Paso.RECHAZADO
                }
                FalloEnvio.SesionVencida -> {
                    Log.w(TAG, "Sesión vencida al enviar ${e.id}")
                    dao.anotarFallo(e.id, "Tu sesión expiró. Abre la app con internet para renovarla.", ahora)
                    Paso.DETENER
                }
                is FalloEnvio.Transitorio, FalloEnvio.SinRespuesta -> {
                    Log.w(TAG, "Sin respuesta al enviar ${e.id}; se reintentará", ex)
                    dao.anotarFallo(e.id, "Sin conexión con el servidor. Se reintentará solo.", ahora)
                    Paso.DETENER
                }
            }
        }
    }

    private companion object {
        const val TAG = "MoncopulliEscritura"
    }
}
