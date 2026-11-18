package cl.moncopulli.app.data.cache

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Upsert

/**
 * Última respuesta del servidor para cada lista (JSON tal cual lo devolvió PostgREST).
 * Se guarda la lista completa porque siempre se reemplaza y se lee completa: no hay consultas por fila.
 */
@Entity(tableName = "cache")
data class CacheEntity(
    // "dosis", "animales", "resguardos", "inventario" y "perfil" (sin él la app no abre sin red).
    @PrimaryKey val clave: String,
    val json: String,
    val guardadoEn: Long,            // epoch ms
)

@Dao
interface CacheDao {
    @Upsert
    suspend fun guardar(c: CacheEntity)

    @Query("SELECT * FROM cache WHERE clave = :clave")
    suspend fun leer(clave: String): CacheEntity?

    @Query("DELETE FROM cache")
    suspend fun borrarTodo()
}

/**
 * Base aparte del outbox: aquí todo se puede volver a descargar, así que si cambia el esquema
 * se borra y se recrea (fallbackToDestructiveMigration en BaseDatosModule).
 */
@Database(entities = [CacheEntity::class], version = 1, exportSchema = false)
abstract class CacheDb : RoomDatabase() {
    abstract fun cache(): CacheDao
}
