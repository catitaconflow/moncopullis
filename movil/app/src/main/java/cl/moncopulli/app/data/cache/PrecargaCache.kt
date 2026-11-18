package cl.moncopulli.app.data.cache

import android.util.Log
import cl.moncopulli.app.data.animal.AnimalRepository
import cl.moncopulli.app.data.dosis.DosisRepository
import cl.moncopulli.app.data.inventario.InventarioRepository
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

/**
 * Deja guardadas en la caché las listas que se usan sin red (Inicio, Animales, Inventario y los
 * catálogos de Registrar), aunque el usuario no haya abierto esas pestañas. Así, si pierde la señal
 * en terreno, todo funciona igual. Cada repositorio ya guarda lo que lee: aquí solo se leen.
 */
@Singleton
class PrecargaCache @Inject constructor(
    private val dosis: DosisRepository,
    private val animales: AnimalRepository,
    private val inventario: InventarioRepository,
) {
    suspend fun precargar() = coroutineScope {
        launch { intentar("dosis") { dosis.programadasHastaHoy() } }
        launch { intentar("animales") { animales.listarVivos() } }
        launch { intentar("inventario") { inventario.listar() } }
    }

    /** Un fallo aquí no se muestra: es solo preparación y cada pantalla maneja sus propios errores. */
    private suspend fun intentar(nombre: String, leer: suspend () -> Unit) {
        try {
            leer()
            Log.i(TAG, "Precarga de '$nombre' lista")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.i(TAG, "Precarga de '$nombre' falló: ${e.message}")
        }
    }

    private companion object {
        const val TAG = "MoncopulliCache"
    }
}
