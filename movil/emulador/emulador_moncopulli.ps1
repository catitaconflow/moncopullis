# Emulador Android para probar la app Moncopulli en Windows (sin Android Studio).
# Descarga (una sola vez, ~4 GB): Java 21, herramientas de Android, el emulador y una imagen de Android 15.
# Luego crea un teléfono virtual "Moncopulli" (Pixel 8), lo inicia e instala el APK que esté junto a este script.
# Uso: doble clic en INICIAR_EMULADOR.bat  (o: powershell -ExecutionPolicy Bypass -File emulador_moncopulli.ps1)
# Requisito: virtualización activa (en Windows: "Plataforma de hipervisor de Windows" activada; ver README).

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # descargas mucho más rápidas
$Base   = Join-Path $env:LOCALAPPDATA "MoncopulliEmulador"
$Sdk    = Join-Path $Base "sdk"
$Jdk    = Join-Path $Base "jdk"
$Imagen = "system-images;android-35;google_apis;x86_64"
$Avd    = "Moncopulli"
$Aqui   = Split-Path -Parent $MyInvocation.MyCommand.Path
New-Item -ItemType Directory -Force -Path $Base, $Sdk | Out-Null

function Paso($t) { Write-Host "`n==> $t" -ForegroundColor Green }

# 1. Java (sdkmanager lo necesita)
if (-not (Test-Path (Join-Path $Jdk "bin\java.exe"))) {
    Paso "Descargando Java 21 (Temurin)..."
    $zip = Join-Path $Base "jdk.zip"
    Invoke-WebRequest "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse" -OutFile $zip
    $tmp = Join-Path $Base "jdk_tmp"; Expand-Archive $zip $tmp -Force
    Move-Item (Get-ChildItem $tmp | Select-Object -First 1).FullName $Jdk
    Remove-Item $zip, $tmp -Recurse -Force
}
$env:JAVA_HOME = $Jdk
$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk
$env:ANDROID_AVD_HOME = Join-Path $Base "avd"
New-Item -ItemType Directory -Force -Path $env:ANDROID_AVD_HOME | Out-Null

# 2. Herramientas de línea de comandos de Android
$sdkmanager = Join-Path $Sdk "cmdline-tools\latest\bin\sdkmanager.bat"
if (-not (Test-Path $sdkmanager)) {
    Paso "Descargando herramientas de Android..."
    $xml = (Invoke-WebRequest "https://dl.google.com/android/repository/repository2-3.xml" -UseBasicParsing).Content
    $nombre = [regex]::Match($xml, "commandlinetools-win-\d+_latest\.zip").Value
    $zip = Join-Path $Base "cmd.zip"
    Invoke-WebRequest "https://dl.google.com/android/repository/$nombre" -OutFile $zip
    $tmp = Join-Path $Base "cmd_tmp"; Expand-Archive $zip $tmp -Force
    New-Item -ItemType Directory -Force -Path (Join-Path $Sdk "cmdline-tools") | Out-Null
    Move-Item (Join-Path $tmp "cmdline-tools") (Join-Path $Sdk "cmdline-tools\latest")
    Remove-Item $zip, $tmp -Recurse -Force
}

# 3. Emulador, adb e imagen de Android 15 (acepta licencias automáticamente)
$emulador = Join-Path $Sdk "emulator\emulator.exe"
$adb = Join-Path $Sdk "platform-tools\adb.exe"
if (-not (Test-Path (Join-Path $Sdk "system-images\android-35\google_apis\x86_64"))) {
    Paso "Descargando emulador e imagen de Android 15 (puede tardar 10 a 30 minutos)..."
    $si = ("y`n" * 30)
    $si | & $sdkmanager --licenses | Out-Null
    & $sdkmanager "platform-tools" "emulator" $Imagen
}

# 4. Teléfono virtual
$avdmanager = Join-Path $Sdk "cmdline-tools\latest\bin\avdmanager.bat"
if (-not (Test-Path (Join-Path $env:ANDROID_AVD_HOME "$Avd.avd"))) {
    Paso "Creando el teléfono virtual Moncopulli (Pixel 8)..."
    "no" | & $avdmanager create avd -n $Avd -k $Imagen -d pixel_8 --force
}

# 5. Iniciar el emulador
Paso "Iniciando el emulador (la primera vez demora 1 a 3 minutos)..."
Start-Process $emulador -ArgumentList "-avd", $Avd, "-netdelay", "none", "-netspeed", "full"
& $adb wait-for-device
do { Start-Sleep -Seconds 3; $listo = (& $adb shell getprop sys.boot_completed 2>$null) } while ($listo -notmatch "1")

# 6. Instalar el APK que esté en esta carpeta
$apk = Get-ChildItem $Aqui -Filter *.apk | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($apk) {
    Paso "Instalando $($apk.Name)..."
    & $adb install -r $apk.FullName
    & $adb shell monkey -p cl.moncopulli.app -c android.intent.category.LAUNCHER 1 | Out-Null
    Paso "Listo. La app Moncopulli está abierta en el emulador."
} else {
    Write-Host "No encontré un .apk en $Aqui. Copia el APK aquí y vuelve a ejecutar." -ForegroundColor Yellow
}
Write-Host "`nPara instalar una versión nueva: deja el .apk en esta carpeta y vuelve a ejecutar INICIAR_EMULADOR.bat."
Read-Host "Presiona Enter para cerrar esta ventana (el emulador sigue abierto)"
