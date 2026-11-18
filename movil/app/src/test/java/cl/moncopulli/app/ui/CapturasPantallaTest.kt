package cl.moncopulli.app.ui

import android.graphics.Bitmap
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import cl.moncopulli.app.data.animal.AnimalResumen
import cl.moncopulli.app.data.dosis.DosisDelDia
import cl.moncopulli.app.data.envio.Envio
import cl.moncopulli.app.data.envio.EstadoEnvio
import cl.moncopulli.app.data.envio.TipoEnvio
import cl.moncopulli.app.data.inventario.LoteStock
import cl.moncopulli.app.data.inventario.MedicamentoStock
import cl.moncopulli.app.ui.actividad.TarjetaEnvio
import cl.moncopulli.app.ui.animales.TarjetaAnimal
import cl.moncopulli.app.ui.comun.CampoBusqueda
import cl.moncopulli.app.ui.comun.EncabezadoSeccion
import cl.moncopulli.app.ui.inicio.ResumenDia
import cl.moncopulli.app.ui.inicio.TarjetaDosis
import cl.moncopulli.app.ui.inventario.TarjetaMedicamento
import cl.moncopulli.app.ui.login.LoginScreen
import cl.moncopulli.app.ui.navegacion.BarraInferior
import cl.moncopulli.app.ui.navegacion.ChipConexion
import cl.moncopulli.app.ui.navegacion.Pestana
import cl.moncopulli.app.ui.sesion.LoginUi
import cl.moncopulli.app.ui.theme.MoncopulliTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * Genera capturas PNG de las pantallas rediseñadas con datos ficticios, sin emulador.
 * Salida: app/build/capturas/. Ejecutar: ./gradlew testDebugUnitTest --tests "*CapturasPantallaTest*"
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w400dp-h860dp-xhdpi")
class CapturasPantallaTest {

    @get:Rule val regla = createAndroidComposeRule<ComponentActivity>()

    private val ahora = OffsetDateTime.now(ZoneOffset.ofHours(-3))
    private val hoy = LocalDate.now()

    private fun guardar(nombre: String, contenido: @Composable () -> Unit) {
        regla.setContent { MoncopulliTheme { contenido() } }
        regla.waitForIdle()
        // Se dibuja la vista raíz en un Bitmap (captureToImage no funciona bajo Robolectric).
        val v = regla.activity.window.decorView
        val bmp = Bitmap.createBitmap(v.width, v.height, Bitmap.Config.ARGB_8888)
        v.draw(android.graphics.Canvas(bmp))
        val dir = File("build/capturas").apply { mkdirs() }
        File(dir, "$nombre.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    private fun Marco(pestana: Pestana, pendientes: Int = 0, contenido: @Composable () -> Unit) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(pestana.etiqueta, style = MaterialTheme.typography.headlineSmall) },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
                    actions = {
                        ChipConexion(enLinea = true, pendientes = pendientes, onClick = {})
                        Box(
                            Modifier.padding(horizontal = 8.dp)
                                .background(MaterialTheme.colorScheme.primary, MaterialTheme.shapes.extraLarge)
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                        ) { Text("LB", color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.labelLarge) }
                    },
                )
            },
            bottomBar = { BarraInferior(pestana, pendientes, 0) {} },
            containerColor = MaterialTheme.colorScheme.background,
        ) { p -> Box(Modifier.padding(p).fillMaxSize()) { contenido() } }
    }

    @Composable
    private fun Lista(contenido: androidx.compose.foundation.lazy.LazyListScope.() -> Unit) {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = contenido,
        )
    }

    private fun dosis(id: Long, minutos: Long, diio: String, med: String, cant: Double, cat: String = "VACA") =
        DosisDelDia(id, ahora.plusMinutes(minutos), cant, "ML", med, id, diio, cat)

    @Test fun t1_login() = guardar("01_login") { LoginScreen(LoginUi(), onIniciar = { _, _ -> }) }

    @Test fun t2_inicio() = guardar("02_inicio") {
        Marco(Pestana.INICIO) {
            val lista = listOf(
                dosis(1, -95, "900000077", "Oxitetraciclina 200 LA", 5.0),
                dosis(2, 40, "900000123", "Meloxicam 2%", 10.0),
                dosis(3, 180, "900000245", "Ivermectina 1%", 4.5, "VAQUILLA"),
            )
            Lista {
                item { ResumenDia("miércoles, 18 de noviembre", lista.size, 1, false) }
                lista.forEach { d ->
                    item { TarjetaDosis(d, ahora, hoy, true, true, {}, {}) }
                }
            }
        }
    }

    @Test fun t3_animales() = guardar("03_animales") {
        Marco(Pestana.ANIMALES) {
            Lista {
                item { CampoBusqueda("", {}, "Buscar por DIIO") }
                item {
                    TarjetaAnimal(
                        AnimalResumen(1, "900000077", "VACA", "LACTANCIA", LocalDate.of(2021, 3, 4), null, null, ahora.plusDays(3)),
                        enResguardo = true,
                    )
                }
                item { TarjetaAnimal(AnimalResumen(2, "900000123", "VACA", "SECA", LocalDate.of(2020, 8, 10), "Juan Soto", null, null), false) }
                item { TarjetaAnimal(AnimalResumen(3, "900000245", "VAQUILLA", null, LocalDate.of(2024, 1, 2), null, "Arete reemplazado", null), false) }
            }
        }
    }

    @Test fun t4_inventario() = guardar("04_inventario") {
        Marco(Pestana.INVENTARIO) {
            Lista {
                item { CampoBusqueda("", {}, "Buscar medicamento o principio activo") }
                item {
                    TarjetaMedicamento(
                        MedicamentoStock(1, "Oxitetraciclina 200 LA", "oxitetraciclina", "ML", 45.0, 100.0, listOf(
                            LoteStock(1, "OXI-2611", hoy.plusDays(20), 15.0),
                            LoteStock(2, "OXI-2702", hoy.plusDays(150), 30.0),
                        )), hoy, true, {},
                    )
                }
                item {
                    TarjetaMedicamento(
                        MedicamentoStock(2, "Meloxicam 2%", "meloxicam", "ML", 380.0, 100.0,
                            listOf(LoteStock(3, "MEL-01", hoy.plusDays(300), 380.0))), hoy, true, {},
                    )
                }
            }
        }
    }

    @Test fun t5_actividad() = guardar("05_actividad") {
        Marco(Pestana.ACTIVIDAD, pendientes = 2) {
            Lista {
                item { EncabezadoSeccion("Rechazados", cantidad = 1) }
                item {
                    TarjetaEnvio(
                        Envio("a", TipoEnvio.APLICAR_DOSIS, EstadoEnvio.RECHAZADO, "Oxitetraciclina 5 ml a 900000077",
                            ahora.minusHours(1), ahora.minusHours(1), "Esta dosis ya fue aplicada por otro usuario.", null, null),
                        ahora,
                    )
                }
                item { EncabezadoSeccion("Por enviar", cantidad = 2) }
                item {
                    TarjetaEnvio(
                        Envio("b", TipoEnvio.REGISTRAR_APLICACION, EstadoEnvio.PENDIENTE, "Meloxicam 10 ml a 900000123",
                            ahora.minusMinutes(12), ahora.minusMinutes(12), null, null, null),
                        ahora,
                    )
                }
                item { EncabezadoSeccion("Enviados (últimos 7 días)", cantidad = 1) }
                item {
                    TarjetaEnvio(
                        Envio("c", TipoEnvio.APLICAR_DOSIS, EstadoEnvio.ENVIADO, "Ivermectina 4,5 ml a 900000245",
                            ahora.minusHours(3), ahora.minusHours(3), null, "IVE-03", ahora.plusDays(2)),
                        ahora,
                    )
                }
            }
        }
    }

    @Test fun t6_inicio_fuente_maxima() = guardar("06_inicio_fuente_2x") {
        androidx.compose.runtime.CompositionLocalProvider(
            androidx.compose.ui.platform.LocalDensity provides androidx.compose.ui.unit.Density(2f, fontScale = 2f),
        ) {
            Column(Modifier.background(MaterialTheme.colorScheme.background).padding(16.dp)) {
                TarjetaDosis(dosis(1, -95, "900000077", "[FALSO] Antiinflamatorio Prueba", 5.0), ahora, hoy, true, true, {}, {})
            }
        }
    }
}
