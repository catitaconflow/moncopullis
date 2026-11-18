# Herramientas para el ciclo 3 de pruebas en el emulador (usa el adb que instaló INICIAR_EMULADOR.bat).
# Uso: herramientas_prueba.ps1 captura | fuente-max | fuente-normal | red-lenta | red-normal
param([string]$accion = "captura", [string]$nombre = "")
$ErrorActionPreference = "Stop"
$adb = Join-Path $env:LOCALAPPDATA "MoncopulliEmulador\sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) { Write-Host "Primero ejecuta INICIAR_EMULADOR.bat" -ForegroundColor Red; Read-Host "Enter para cerrar"; exit 1 }
$Aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
switch ($accion) {
  "captura" {
    $dir = Join-Path $Aqui "capturas_ciclo3"; New-Item -ItemType Directory -Force -Path $dir | Out-Null
    if (-not $nombre) { $nombre = Read-Host "Nombre del caso (ej. MOV-07)" }
    $archivo = Join-Path $dir ("{0}_{1}.png" -f $nombre, (Get-Date -Format "HHmmss"))
    & $adb shell screencap -p /sdcard/cap.png; & $adb pull /sdcard/cap.png $archivo | Out-Null; & $adb shell rm /sdcard/cap.png
    Write-Host "Captura guardada: $archivo" -ForegroundColor Green
  }
  "fuente-max"    { & $adb shell settings put system font_scale 2.0; & $adb shell settings put secure display_density_forced 560; Write-Host "Fuente y pantalla al máximo (MOV-37)" -ForegroundColor Green }
  "fuente-normal" { & $adb shell settings put system font_scale 1.0; & $adb shell settings delete secure display_density_forced; Write-Host "Fuente y pantalla normales" -ForegroundColor Green }
  "red-lenta"     { & $adb emu network speed gsm; & $adb emu network delay gprs; Write-Host "Red lenta tipo 2G activada (MOV-33)" -ForegroundColor Green }
  "red-normal"    { & $adb emu network speed full; & $adb emu network delay none; Write-Host "Red normal" -ForegroundColor Green }
}
Start-Sleep -Seconds 2
