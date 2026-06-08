# Clean reinstall of the plugin into Stream Deck.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/reinstall.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$pluginFile = Join-Path $root "com.vladoportos.aimonitor.streamDeckPlugin"
$installedPath = Join-Path $env:APPDATA "Elgato\StreamDeck\Plugins\com.vladoportos.aimonitor.sdPlugin"

Write-Host "[reinstall] Stopping Stream Deck..." -ForegroundColor Cyan
Get-Process StreamDeck -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

if (Test-Path $installedPath) {
    Write-Host "[reinstall] Removing existing plugin folder..." -ForegroundColor Cyan
    Remove-Item $installedPath -Recurse -Force
}

if (-not (Test-Path $pluginFile)) {
    Write-Host "[reinstall] Building plugin package..." -ForegroundColor Cyan
    Push-Location $root
    try { node scripts/pack.mjs } finally { Pop-Location }
}

Write-Host "[reinstall] Launching plugin installer..." -ForegroundColor Cyan
Start-Process $pluginFile

Write-Host "[reinstall] Done. Click 'Install' in the Stream Deck dialog that just appeared." -ForegroundColor Green
Write-Host "[reinstall] After installation:"
Write-Host "  - Drag any 'AI Monitor' action onto a key"
Write-Host "  - First poll happens within ~10 seconds"
Write-Host "  - If keys still don't update, check  ~/.ai-monitor-streamdeck/startup.log"
