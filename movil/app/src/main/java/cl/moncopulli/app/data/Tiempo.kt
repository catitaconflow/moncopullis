package cl.moncopulli.app.data

import java.time.ZoneId

/** "Hoy" y las horas se calculan siempre en hora de Chile, no con la zona del teléfono. */
val ZONA_CHILE: ZoneId = ZoneId.of("America/Santiago")