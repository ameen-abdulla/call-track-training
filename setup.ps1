# Call Track (Training) — Setup Script
# Right-click this file and choose "Run with PowerShell"

$ErrorActionPreference = "Stop"
$appDir = $PSScriptRoot
$desktopPath = [Environment]::GetFolderPath("Desktop")

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "    Call Track (Training) — Setup" -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

# Check Docker is installed
try {
    docker --version | Out-Null
    Write-Host "  Docker found." -ForegroundColor Green
} catch {
    Write-Host "  Docker Desktop is not installed." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Please install Docker Desktop first:" -ForegroundColor White
    Write-Host "  https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
    Write-Host ""
    Start-Process "https://www.docker.com/products/docker-desktop"
    Write-Host "  Opening the download page in your browser..." -ForegroundColor Gray
    Write-Host "  Once installed, run this setup script again." -ForegroundColor Gray
    Write-Host ""
    Read-Host "  Press Enter to exit"
    exit
}

# Create START shortcut on Desktop
$startShortcut = Join-Path $desktopPath "Start Call Track (Training).lnk"
$startCmd = "docker compose -f `"$appDir\docker-compose.yml`" up -d ; Start-Sleep -Seconds 8 ; Start-Process 'http://localhost:4000'"

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($startShortcut)
$sc.TargetPath = "powershell.exe"
$sc.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -Command `"$startCmd`""
$sc.WorkingDirectory = $appDir
$sc.Description = "Start Call Track Training App (Port 4000)"
$sc.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,137"
$sc.Save()

Write-Host "  Created: 'Start Call Track (Training)' on Desktop" -ForegroundColor Green

# Create STOP shortcut on Desktop
$stopShortcut = Join-Path $desktopPath "Stop Call Track (Training).lnk"
$stopCmd = "docker compose -f `"$appDir\docker-compose.yml`" down"

$sc2 = $wsh.CreateShortcut($stopShortcut)
$sc2.TargetPath = "powershell.exe"
$sc2.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -Command `"$stopCmd`""
$sc2.WorkingDirectory = $appDir
$sc2.Description = "Stop Call Track Training App"
$sc2.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,131"
$sc2.Save()

Write-Host "  Created: 'Stop Call Track (Training)' on Desktop" -ForegroundColor Green
Write-Host ""
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Two shortcuts have been added to your Desktop:" -ForegroundColor White
Write-Host "   - 'Start Call Track (Training)'  -- double-click to launch training app (port 4000)" -ForegroundColor White
Write-Host "   - 'Stop Call Track (Training)'   -- double-click to shut it down" -ForegroundColor White
Write-Host ""
Write-Host "  IMPORTANT: The first start will take 3-5 minutes to build." -ForegroundColor Yellow
Write-Host "  After that it starts in seconds." -ForegroundColor Yellow
Write-Host ""
Read-Host "  Press Enter to finish"
