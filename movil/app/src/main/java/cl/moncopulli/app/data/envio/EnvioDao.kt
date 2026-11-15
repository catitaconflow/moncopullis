package cl.moncopulli.app.data.envio

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface EnvioDao {

    // ABORT: un id repetido es un error de programación, no algo que se deba pisar en silencio.
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertar(e: EnvioEntity)

    /** Pendientes de un usuario, en el orden en que se hicieron. */
    @Query("SELECT * FROM envio WHERE estado = 'PENDIENTE' AND usuarioAuthId = :uid ORDER BY creadoEn")
    suspend fun pendientesDe(uid: String): List<EnvioEntity>

    @Query("SELECT COUNT(*) FROM envio WHERE estado = 'PENDIENTE'")
    suspend fun contarPendientes(): Int

    @Query(
        """UPDATE envio SET estado = 'ENVIADO', lote = :lote, resguardoHasta = :resguardoHasta,
           ultimoError = NULL, intentos = intentos + 1, actualizadoEn = :ahora WHERE id = :id"""
    )
    suspend fun marcarEnviado(id: String, lote: String?, resguardoHasta: String?, ahora: Long)

    @Query(
        """UPDATE envio SET estado = 'RECHAZADO', ultimoError = :error,
           intentos = intentos + 1, actualizadoEn = :ahora WHERE id = :id"""
    )
    suspend fun marcarRechazado(id: String, error: String, ahora: Long)

    /** Sigue PENDIENTE; se anota el motivo para mostrarlo en Actividad. */
    @Query("UPDATE envio SET ultimoError = :error, intentos = intentos + 1, actualizadoEn = :ahora WHERE id = :id")
    suspend fun anotarFallo(id: String, error: String, ahora: Long)

    /**
     * Dosis aplicadas desde este teléfono, enviadas o por enviar. El servidor las sigue devolviendo
     * como PROGRAMADA hasta que llega el envío (y unos segundos después), así que Inicio las oculta.
     * Las RECHAZADO no se incluyen: si la dosis sigue programada (p. ej. faltó stock) debe volver a verse.
     */
    @Query("SELECT DISTINCT dosisId FROM envio WHERE dosisId IS NOT NULL AND estado IN ('PENDIENTE', 'ENVIADO')")
    fun observarDosisAplicadasAqui(): Flow<List<Long>>

    // --- Actividad ---

    @Query("SELECT * FROM envio ORDER BY creadoEn DESC LIMIT 300")
    fun observarTodos(): Flow<List<EnvioEntity>>

    @Query("SELECT COUNT(*) FROM envio WHERE estado = 'PENDIENTE'")
    fun observarCantidadPendientes(): Flow<Int>

    @Query("SELECT COUNT(*) FROM envio WHERE estado = 'RECHAZADO'")
    fun observarCantidadRechazados(): Flow<Int>

    /** Solo una RECHAZADO vuelve a la cola (mismos parámetros: el reenvío sigue siendo idempotente). */
    @Query(
        """UPDATE envio SET estado = 'PENDIENTE', ultimoError = NULL, actualizadoEn = :ahora
           WHERE id = :id AND estado = 'RECHAZADO'"""
    )
    suspend fun volverAPendiente(id: String, ahora: Long): Int

    /** Solo se descartan RECHAZADO: una PENDIENTE podría ser una aplicación real aún no registrada. */
    @Query("DELETE FROM envio WHERE id = :id AND estado = 'RECHAZADO'")
    suspend fun descartarRechazado(id: String): Int

    @Query("DELETE FROM envio WHERE estado = 'ENVIADO' AND actualizadoEn < :limite")
    suspend fun borrarEnviadosAntesDe(limite: Long)

    /** Solo al cerrar sesión, después de que el usuario confirmó que se pierden los pendientes. */
    @Query("DELETE FROM envio")
    suspend fun borrarTodo()
}
