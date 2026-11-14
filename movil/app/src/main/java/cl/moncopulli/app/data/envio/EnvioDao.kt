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
}
