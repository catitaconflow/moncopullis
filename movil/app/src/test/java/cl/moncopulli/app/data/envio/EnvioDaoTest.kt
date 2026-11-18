package cl.moncopulli.app.data.envio

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * AUT-02: la cola de envíos (outbox) con Room en memoria, sin teléfono (Robolectric).
 * Cubre las seis reglas que la app necesita para no perder ni duplicar aplicaciones sin señal.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class EnvioDaoTest {

    private lateinit var db: EnviosDb
    private lateinit var dao: EnvioDao

    @Before fun abrir() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(ctx, EnviosDb::class.java).allowMainThreadQueries().build()
        dao = db.envios()
    }

    @After fun cerrar() = db.close()

    private fun envio(id: String, creado: Long, usuario: String = "u1", dosis: Long? = null, estado: String = EstadoEnvio.PENDIENTE) =
        EnvioEntity(
            id = id, tipo = TipoEnvio.APLICAR_DOSIS.name, usuarioAuthId = usuario, parametros = "{}",
            dosisId = dosis, resumen = "Prueba $id", estado = estado, creadoEn = creado, actualizadoEn = creado,
        )

    @Test fun e1_pendientes_en_orden_y_solo_del_usuario() = runBlocking {
        dao.insertar(envio("b", 2))
        dao.insertar(envio("a", 1))
        dao.insertar(envio("otro", 0, usuario = "u2"))
        assertEquals(listOf("a", "b"), dao.pendientesDe("u1").map { it.id })
        assertEquals(3, dao.contarPendientes())
    }

    @Test fun e2_id_repetido_es_error_no_se_pisa() = runBlocking {
        dao.insertar(envio("a", 1))
        try {
            dao.insertar(envio("a", 2))
            fail("Debía rechazar un id repetido")
        } catch (_: Exception) { /* esperado: ABORT */ }
        assertEquals(1L, dao.pendientesDe("u1").single().creadoEn)
    }

    @Test fun e3_enviado_guarda_lote_y_sale_de_pendientes() = runBlocking {
        dao.insertar(envio("a", 1, dosis = 10))
        dao.marcarEnviado("a", "L-01", "2026-11-20T10:00:00-03:00", 5)
        val e = dao.observarTodos().first().single()
        assertEquals(EstadoEnvio.ENVIADO, e.estado)
        assertEquals("L-01", e.lote)
        assertEquals(1, e.intentos)
        assertEquals(0, dao.contarPendientes())
        assertEquals(listOf(10L), dao.observarDosisAplicadasAqui().first())
    }

    @Test fun e4_fallo_pasajero_sigue_pendiente_y_cuenta_intentos() = runBlocking {
        dao.insertar(envio("a", 1))
        dao.anotarFallo("a", "Sin conexión", 2)
        dao.anotarFallo("a", "Sin conexión", 3)
        val e = dao.pendientesDe("u1").single()
        assertEquals(2, e.intentos)
        assertEquals("Sin conexión", e.ultimoError)
    }

    @Test fun e5_rechazado_vuelve_a_pendiente_o_se_descarta_y_pendiente_no_se_descarta() = runBlocking {
        dao.insertar(envio("r", 1, dosis = 7))
        dao.insertar(envio("p", 2))
        dao.marcarRechazado("r", "Stock insuficiente", 3)
        assertEquals(1, dao.observarCantidadRechazados().first())
        assertTrue("Un rechazado no oculta la dosis en Inicio", dao.observarDosisAplicadasAqui().first().isEmpty())
        assertEquals(0, dao.descartarRechazado("p"))   // una PENDIENTE no se puede descartar
        assertEquals(1, dao.volverAPendiente("r", 4))
        assertEquals(0, dao.volverAPendiente("r", 5))  // ya no está RECHAZADO
        dao.marcarRechazado("r", "Stock insuficiente", 6)
        assertEquals(1, dao.descartarRechazado("r"))
        assertEquals(listOf("p"), dao.observarTodos().first().map { it.id })
    }

    @Test fun e6_limpieza_de_enviados_antiguos_y_cierre_de_sesion() = runBlocking {
        dao.insertar(envio("viejo", 1))
        dao.insertar(envio("nuevo", 2))
        dao.insertar(envio("pend", 3))
        dao.marcarEnviado("viejo", null, null, 100)
        dao.marcarEnviado("nuevo", null, null, 900)
        dao.borrarEnviadosAntesDe(500)
        assertEquals(setOf("nuevo", "pend"), dao.observarTodos().first().map { it.id }.toSet())
        dao.borrarTodo()
        assertEquals(0, dao.observarTodos().first().size)
    }
}
