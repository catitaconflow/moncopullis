package cl.moncopulli.app.data.envio

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProgramadorEnvios @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    /**
     * Pide enviar los pendientes cuando haya red. Trabajo ÚNICO con REPLACE: cada pendiente nuevo
     * reemplaza el trabajo anterior (y reinicia la espera entre reintentos). Si el anterior estaba a
     * mitad de un envío y se cancela, no pasa nada: el reenvío es idempotente.
     */
    fun programar() {
        val pedido = OneTimeWorkRequestBuilder<EnviarPendientesWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            // Reintento creciente: 30 s, 60 s, 120 s… (WorkManager lo limita a 5 h).
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(NOMBRE, ExistingWorkPolicy.REPLACE, pedido)
    }

    companion object {
        const val NOMBRE = "enviar-pendientes"
    }
}
