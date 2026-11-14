package cl.moncopulli.app.data.envio

import android.util.Log
import cl.moncopulli.app.data.ZONA_CHILE
import cl.moncopulli.app.data.dosis.DosisAplicada
import cl.moncopulli.app.data.dosis.DosisDelDia
import cl.moncopulli.app.data.dosis.DosisRepository
import cl.moncopulli.app.data.dosis.NuevoRegistro
import cl.moncopulli.app.data.red.MonitorConexion
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import java.time.OffsetDateTime
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.JsonObject

sealed interface ResultadoEnvio {
    /** El servidor confirmó en el momento. */
    data class Enviado(val respuesta: DosisAplicada) : ResultadoEnvio

    /** No hubo respuesta: quedó guardado en el teléfono y se enviará solo. */
    data object EnCola : ResultadoEnvio
}

/**
 * Escrituras idempotentes con envío híbrido:
 * 1. Con red, se intenta la RPC en el momento (el usuario ve lote, resguardo o el error al tiro).
 * 2. Si no hay respuesta (o no hay red), se guarda en el outbox y WorkManager la envía después.
 * Los errores definitivos (P0001, 42501, 401) se lanzan como antes para mostrarlos en pantalla.
 */
@Singleton
class EnviosRepository @Inject constructor(
    private val supabase: SupabaseClient,
    private val dosisRepo: DosisRepository,
    private val dao: EnvioDao,
    private val monitor: MonitorConexion,
    private val programador: ProgramadorEnvios,
) {
    val dosisAplicadasAqui: Flow<Set<Long>> = dao.observarDosisAplicadasAqui().map { it.toSet() }

    /**
     * [fecha] = null significa "ahora". Para el intento directo se envía tal cual (el servidor usa su
     * now()); para la cola se fija la hora de ESTE momento: si se enviara null, el servidor usaría la
     * hora de la sincronización y el resguardo de leche quedaría mal calculado.
     */
    suspend fun aplicarDosis(dosis: DosisDelDia, fecha: OffsetDateTime?, resumen: String): ResultadoEnvio {
        val momento = fecha ?: OffsetDateTime.now(ZONA_CHILE)
        return escribir(
            tipo = TipoEnvio.APLICAR_DOSIS,
            id = UUID.randomUUID().toString(),
            dosisId = dosis.id,
            resumen = resumen,
            paramsDirecto = dosisRepo.paramsAplicar(dosis.id, fecha),
            paramsCola = dosisRepo.paramsAplicar(dosis.id, momento),
        )
    }

    /**
     * Registro en terreno. El id de la fila es el mismo p_uuid: si el intento directo llegó al
     * servidor pero no la respuesta, el reenvío desde la cola responde 'ya_registrado' sin descontar
     * stock dos veces. La fecha se fija igual que en [aplicarDosis].
     */
    suspend fun registrarAplicacion(r: NuevoRegistro, resumen: String): ResultadoEnvio {
        val momento = r.fecha ?: OffsetDateTime.now(ZONA_CHILE)
        return escribir(
            tipo = TipoEnvio.REGISTRAR_APLICACION,
            id = r.uuid.toString(),
            dosisId = null,
            resumen = resumen,
            paramsDirecto = dosisRepo.paramsRegistrar(r),
            paramsCola = dosisRepo.paramsRegistrar(r.copy(fecha = momento)),
        )
    }

    private suspend fun escribir(
        tipo: TipoEnvio,
        id: String,
        dosisId: Long?,
        resumen: String,
        paramsDirecto: JsonObject,
        paramsCola: JsonObject,
    ): ResultadoEnvio {
        val uid = supabase.auth.currentSessionOrNull()?.user?.id
            ?: throw IllegalStateException("No hay sesión.")
        val ahora = System.currentTimeMillis()
        val fila = EnvioEntity(
            id = id, tipo = tipo.name, usuarioAuthId = uid, parametros = paramsCola.toString(),
            dosisId = dosisId, resumen = resumen, estado = EstadoEnvio.PENDIENTE,
            creadoEn = ahora, actualizadoEn = ahora,
        )

        // Sin red conocida se salta el intento directo (evita esperar el timeout).
        val intentarDirecto = monitor.estadoActual()
        if (intentarDirecto) {
            try {
                val r = dosisRepo.llamarRpcApp(tipo.rpc, paramsDirecto)
                dao.insertar(
                    fila.copy(
                        estado = EstadoEnvio.ENVIADO, lote = r.lote,
                        resguardoHasta = r.resguardoHasta?.toString(), intentos = 1,
                    )
                )
                return ResultadoEnvio.Enviado(r)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                when (clasificarFallo(e)) {
                    FalloEnvio.SinRespuesta, is FalloEnvio.Transitorio ->
                        Log.w(TAG, "Sin respuesta al enviar ${tipo.name} $id; queda en cola", e)
                    else -> throw e // rechazo o sesión vencida: se muestra en el diálogo como antes
                }
            }
        }
        dao.insertar(fila.copy(intentos = if (intentarDirecto) 1 else 0))
        programador.programar()
        return ResultadoEnvio.EnCola
    }

    private companion object {
        const val TAG = "MoncopulliEscritura"
    }
}
