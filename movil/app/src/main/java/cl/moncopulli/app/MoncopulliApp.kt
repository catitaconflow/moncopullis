package cl.moncopulli.app

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

/**
 * WorkManager se inicializa a pedido con esta configuración (el inicializador automático se quita en
 * el AndroidManifest). Así WorkManager crea los workers con la fábrica de Hilt y pueden recibir
 * dependencias (@HiltWorker + @AssistedInject).
 */
@HiltAndroidApp
class MoncopulliApp : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}
