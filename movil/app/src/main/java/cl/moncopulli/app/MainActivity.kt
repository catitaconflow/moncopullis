package cl.moncopulli.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import cl.moncopulli.app.ui.theme.MoncopulliTheme
import dagger.hilt.android.AndroidEntryPoint
import androidx.activity.viewModels
import cl.moncopulli.app.ui.prueba.PruebaConexionScreen
import cl.moncopulli.app.ui.prueba.PruebaConexionViewModel
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val pruebaViewModel: PruebaConexionViewModel by viewModels()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MoncopulliTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    PruebaConexionScreen(
                        viewModel = pruebaViewModel,
                        modifier = Modifier.padding(innerPadding)
                    )
                }
            }
        }
    }
}

@Composable
fun Greeting(name: String, modifier: Modifier = Modifier) {
    Text(
        text = "Hello $name!",
        modifier = modifier
    )
}

@Preview(showBackground = true)
@Composable
fun GreetingPreview() {
    MoncopulliTheme {
        Greeting("Android")
    }
}