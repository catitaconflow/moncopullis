package cl.moncopulli.app.ui.navegacion

import androidx.annotation.DrawableRes
import cl.moncopulli.app.R
import kotlinx.serialization.Serializable

@Serializable data object RutaInicio
@Serializable data object RutaAnimales
@Serializable data object RutaRegistrar
@Serializable data object RutaInventario
@Serializable data object RutaActividad

/** Las 5 pestañas de la barra inferior, en orden. */
enum class Pestana(val ruta: Any, val etiqueta: String, @DrawableRes val icono: Int) {
    INICIO(RutaInicio, "Inicio", R.drawable.ic_inicio),
    ANIMALES(RutaAnimales, "Animales", R.drawable.ic_animales),
    REGISTRAR(RutaRegistrar, "Registrar", R.drawable.ic_registrar),
    INVENTARIO(RutaInventario, "Inventario", R.drawable.ic_inventario),
    ACTIVIDAD(RutaActividad, "Actividad", R.drawable.ic_actividad),
}