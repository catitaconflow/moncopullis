package cl.moncopulli.app.data.inventario

/**
 * Motivos de una salida por ajuste (merma). El nombre de cada valor es el que espera fn_registrar_ajuste
 * (CHECK mov_motivo de la 0001); las etiquetas son las de MOTIVOS_AJUSTE del panel (panel/src/lib/etiquetas.ts).
 */
enum class MotivoSalida(val etiqueta: String) {
    VENCIDO("Vencido"),
    ROTO_DERRAME("Roto o derramado"),
    CONTEO("Conteo físico"),
    OTRO("Otro"),
}
