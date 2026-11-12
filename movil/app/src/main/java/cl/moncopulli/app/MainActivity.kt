package cl.moncopulli.app

import android.graphics.Color as ColorAndroid
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import cl.moncopulli.app.ui.AppRoot
import cl.moncopulli.app.ui.theme.MoncopulliTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Íconos oscuros en las barras del sistema aunque el teléfono esté en modo oscuro (la app es solo clara).
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(ColorAndroid.TRANSPARENT, ColorAndroid.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(ColorAndroid.TRANSPARENT, ColorAndroid.TRANSPARENT),
        )
        setContent {
            MoncopulliTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    AppRoot(modifier = Modifier.padding(innerPadding))
                }
            }
        }
    }
}