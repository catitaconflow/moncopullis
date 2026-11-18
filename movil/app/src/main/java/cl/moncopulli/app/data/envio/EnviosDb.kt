package cl.moncopulli.app.data.envio

import androidx.room.Database
import androidx.room.RoomDatabase

/**
 * Base SOLO para el outbox, separada de la caché de lectura (paso 5).
 * Motivo: la caché se puede borrar y recrear sin perder nada, pero aquí hay aplicaciones de
 * medicamentos que aún no llegan al servidor. Por eso esta base NO usa fallbackToDestructiveMigration:
 * si algún día cambia el esquema, hay que escribir una Migration (subir version + addMigrations).
 */
@Database(entities = [EnvioEntity::class], version = 1, exportSchema = false)
abstract class EnviosDb : RoomDatabase() {
    abstract fun envios(): EnvioDao
}
