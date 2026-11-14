package cl.moncopulli.app.data

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Aviso entre pantallas: "se escribió algo en el servidor, recarga".
 * Quien escribe llama a avisar(); las pantallas que muestran datos afectados (stock, resguardo)
 * escuchan [cambios]. Un SharedFlow no guarda el último valor: si nadie escucha, el aviso se pierde,
 * y está bien, porque una pantalla que se crea después ya carga datos frescos.
 */
@Singleton
class CambiosDatos @Inject constructor() {
    private val _cambios = MutableSharedFlow<Unit>(
        extraBufferCapacity = 1,
        onBufferOverflow = BufferOverflow.DROP_OLDEST, // varios avisos seguidos valen por uno
    )
    val cambios: SharedFlow<Unit> = _cambios.asSharedFlow()

    fun avisar() {
        _cambios.tryEmit(Unit)
    }
}
