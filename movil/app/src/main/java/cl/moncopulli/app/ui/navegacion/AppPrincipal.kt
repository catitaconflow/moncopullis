package cl.moncopulli.app.ui.navegacion

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import cl.moncopulli.app.R
import cl.moncopulli.app.data.auth.Perfil
import cl.moncopulli.app.ui.actividad.ActividadScreen
import cl.moncopulli.app.ui.inicio.InicioScreen
import cl.moncopulli.app.ui.animales.AnimalesScreen
import cl.moncopulli.app.ui.inventario.InventarioScreen
import cl.moncopulli.app.ui.theme.Urgente
import cl.moncopulli.app.ui.registrar.RegistrarScreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppPrincipal(
    perfil: Perfil,
    onCerrarSesion: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: PrincipalViewModel = hiltViewModel(),
) {
    val enLinea by viewModel.enLinea.collectAsStateWithLifecycle()
    val pendientes by viewModel.pendientes.collectAsStateWithLifecycle()
    val rechazados by viewModel.rechazados.collectAsStateWithLifecycle()
    var confirmandoCierre by rememberSaveable { mutableStateOf(false) }
    val navController = rememberNavController()
    val entrada by navController.currentBackStackEntryAsState()
    val actual = Pestana.entries.firstOrNull { p ->
        entrada?.destination?.hierarchy?.any { it.hasRoute(p.ruta::class) } == true
    } ?: Pestana.INICIO

    fun irA(p: Pestana) {
        navController.navigate(p.ruta) {
            // Una sola copia de cada pestaña; "atrás" vuelve a Inicio y luego sale.
            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(actual.etiqueta) },
                actions = {
                    ChipConexion(enLinea, pendientes, onClick = { irA(Pestana.ACTIVIDAD) })
                    MenuCuenta(perfil) {
                        // Cerrar sesión borra el outbox: si hay algo sin enviar, preguntar antes.
                        if (pendientes + rechazados > 0) confirmandoCierre = true else onCerrarSesion()
                    }
                },
            )
        },
        bottomBar = {
            BarraInferior(actual, pendientes, rechazados, ::irA)
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = RutaInicio,
            modifier = Modifier.padding(padding),
        ) {
            composable<RutaInicio> { InicioScreen() }
            composable<RutaAnimales> { AnimalesScreen() }
            composable<RutaRegistrar> { RegistrarScreen() }
            composable<RutaInventario> { InventarioScreen() }
            composable<RutaActividad> { ActividadScreen() }
        }
    }

    if (confirmandoCierre) {
        DialogoCerrarSesion(
            pendientes = pendientes,
            rechazados = rechazados,
            onVerActividad = {
                confirmandoCierre = false
                irA(Pestana.ACTIVIDAD)
            },
            onConfirmar = {
                confirmandoCierre = false
                onCerrarSesion()
            },
            onCancelar = { confirmandoCierre = false },
        )
    }
}

@Composable
private fun DialogoCerrarSesion(
    pendientes: Int,
    rechazados: Int,
    onVerActividad: () -> Unit,
    onConfirmar: () -> Unit,
    onCancelar: () -> Unit,
) {
    val partes = buildList {
        if (pendientes > 0) add(if (pendientes == 1) "1 registro por enviar" else "$pendientes registros por enviar")
        if (rechazados > 0) add(if (rechazados == 1) "1 rechazado" else "$rechazados rechazados")
    }
    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text("¿Cerrar sesión?") },
        text = {
            Text(
                "Tienes ${partes.joinToString(" y ")}. Si cierras sesión se borran de este teléfono y " +
                    "no llegarán al sistema. Conéctate a internet y espera a que se envíen, o revísalos en Actividad."
            )
        },
        confirmButton = {
            TextButton(onClick = onVerActividad) { Text("Ver actividad") }
        },
        dismissButton = {
            // Acción destructiva: en rojo y como botón secundario, para no tocarla por error.
            TextButton(onClick = onConfirmar) { Text("Cerrar sesión y borrar", color = Urgente) }
        },
    )
}

@Composable
private fun BarraInferior(actual: Pestana, pendientes: Int, rechazados: Int, onElegir: (Pestana) -> Unit) {
    NavigationBar {
        Pestana.entries.forEach { p ->
            val esRegistrar = p == Pestana.REGISTRAR
            NavigationBarItem(
                selected = p == actual,
                onClick = { onElegir(p) },
                icon = {
                    if (esRegistrar) {
                        // Registrar destacado: círculo verde siempre visible.
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .background(MaterialTheme.colorScheme.primary, CircleShape),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                painterResource(p.icono),
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onPrimary,
                            )
                        }
                    } else if (p == Pestana.ACTIVIDAD && pendientes + rechazados > 0) {
                        IconoConInsignia(p, pendientes, rechazados)
                    } else {
                        Icon(painterResource(p.icono), contentDescription = null)
                    }
                },
                label = { Text(p.etiqueta) },
                colors = if (esRegistrar) {
                    NavigationBarItemDefaults.colors(indicatorColor = Color.Transparent)
                } else {
                    NavigationBarItemDefaults.colors()
                },
            )
        }
    }
}

/**
 * Insignia de Actividad: pendientes + rechazados. Roja si hay rechazados (una aplicación real que no
 * quedó registrada requiere acción); verde si solo hay pendientes (se envían solos).
 */
@Composable
private fun IconoConInsignia(p: Pestana, pendientes: Int, rechazados: Int) {
    val total = pendientes + rechazados
    val hayRechazos = rechazados > 0
    BadgedBox(
        badge = {
            Badge(
                containerColor = if (hayRechazos) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                contentColor = if (hayRechazos) MaterialTheme.colorScheme.onError else MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier.semantics {
                    contentDescription = buildString {
                        if (pendientes > 0) append("$pendientes por enviar. ")
                        if (rechazados > 0) append("$rechazados rechazados.")
                    }
                },
            ) { Text(if (total > 99) "99+" else "$total") }
        },
    ) {
        Icon(painterResource(p.icono), contentDescription = null)
    }
}

@Composable
private fun MenuCuenta(perfil: Perfil, onCerrarSesion: () -> Unit) {
    var abierto by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { abierto = true }) {
            Icon(painterResource(R.drawable.ic_cuenta), contentDescription = "Cuenta")
        }
        DropdownMenu(expanded = abierto, onDismissRequest = { abierto = false }) {
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text("${perfil.nombres} ${perfil.apellidos}", style = MaterialTheme.typography.titleSmall)
                Text(
                    perfil.rol,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            HorizontalDivider()
            DropdownMenuItem(
                text = { Text("Cerrar sesión") },
                onClick = {
                    abierto = false
                    onCerrarSesion()
                },
            )
        }
    }
}