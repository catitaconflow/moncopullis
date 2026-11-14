package cl.moncopulli.app.di

import android.content.Context
import androidx.room.Room
import cl.moncopulli.app.data.envio.EnvioDao
import cl.moncopulli.app.data.envio.EnviosDb
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object BaseDatosModule {

    @Provides
    @Singleton
    fun provideEnviosDb(@ApplicationContext context: Context): EnviosDb =
        // Sin fallbackToDestructiveMigration a propósito (ver EnviosDb).
        Room.databaseBuilder(context, EnviosDb::class.java, "envios.db").build()

    @Provides
    fun provideEnvioDao(db: EnviosDb): EnvioDao = db.envios()
}
