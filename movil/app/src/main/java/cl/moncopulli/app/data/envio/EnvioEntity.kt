package cl.moncopulli.app.data.envio

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import cl.moncopulli.app.data.dosis.RPC_APLICAR
import cl.moncopulli.app.data.dosis.RPC_REGISTRAR

/** Escrituras que pueden esperar en el teléfono: solo las RPC idempotentes de la 0014. */
enum class TipoEnvio(val rpc: String) {
    APLICAR_DOSIS(RPC_APLICAR),               // idempotente si la aplicó el mismo usuario
    REGISTRAR_APLICACION(RPC_REGISTRAR),      // idempotente por p_uuid
}

object EstadoEnvio {
    const val PENDIENTE = "PENDIENTE"   // falta confirmar con el servidor
    const val ENVIADO = "ENVIADO"       // el servidor respondió 'creado' o 'ya_registrado'
    const val RECHAZADO = "RECHAZADO"   // el servidor respondió con un error definitivo (p. ej. sin stock)
}

/**
 * Una escritura hecha desde este teléfono (tabla outbox). Las ENVIADO directas también se guardan,
 * para que Actividad muestre todo y para que Inicio no vuelva a mostrar esa dosis.
 */
@Entity(tableName = "envio", indices = [Index("estado")])
data class EnvioEntity(
    @PrimaryKey val id: String,          // registrar: el p_uuid; aplicar: un uuid local
    val tipo: String,                    // TipoEnvio.name
    val usuarioAuthId: String,           // solo se envía con la sesión de este usuario
    val parametros: String,              // JSON con los p_* tal como se envían (fecha ya fijada)
    val dosisId: Long?,                  // aplicar: la dosis; registrar: null
    val resumen: String,                 // texto para Actividad, p. ej. "Ivomec · 5 ML · DIIO 123456789"
    val estado: String,                  // EstadoEnvio
    val ultimoError: String? = null,
    val lote: String? = null,            // respuesta del servidor
    val resguardoHasta: String? = null,  // ISO 8601 con desfase
    val intentos: Int = 0,
    val creadoEn: Long,                  // epoch ms
    val actualizadoEn: Long,
)
