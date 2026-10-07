<#
.SYNOPSIS
    Reproducible Build Pipeline for Call Track Training Windows Installer.
.DESCRIPTION
    Compiles Next.js into standalone mode, stages Prisma engines and bundled runtimes
    (Node.js 24 LTS, Cloudflared, WinSW), and packages everything into a single-file
    executable installer using Inno Setup.
#>

[CmdletBinding()]
param(
    [string]$Version = "0.2.0",
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  CALL TRACK TRAINING -- WINDOWS INSTALLER BUILD PIPELINE        " -ForegroundColor Cyan
Write-Host "  Version: $Version                                              " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# ── 1. Validate / Prepare Tools Directory ─────────────────────────────────────
$ToolsDir = Join-Path $ScriptDir "tools"
$NodeDir = Join-Path $ToolsDir "node"
$CloudflaredDir = Join-Path $ToolsDir "cloudflared"
$WinSWDir = Join-Path $ToolsDir "winsw"
$InnoDir = Join-Path $ToolsDir "innosetup6\app"

@($ToolsDir, $NodeDir, $CloudflaredDir, $WinSWDir) | ForEach-Object {
    if (-not (Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
}

# Node.js 24 LTS x64 Windows binary
$NodeExe = Join-Path $NodeDir "node.exe"
if (-not (Test-Path $NodeExe)) {
    Write-Host "[1/6] Staging Node.js 24 LTS x64 runtime..." -ForegroundColor Yellow
    curl.exe -Ls -o $NodeExe "https://nodejs.org/dist/v24.18.0/win-x64/node.exe"
}
$NodeVer = & "$NodeExe" -v
Write-Host "  Node.js runtime verified: $NodeVer" -ForegroundColor Green

# Cloudflared Windows x64 binary
$CloudflaredExe = Join-Path $CloudflaredDir "cloudflared.exe"
if (-not (Test-Path $CloudflaredExe)) {
    Write-Host "[2/6] Staging Cloudflared Windows x64 binary..." -ForegroundColor Yellow
    curl.exe -Ls -o $CloudflaredExe "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
}
$CfVer = (& "$CloudflaredExe" --version | Select-Object -First 1)
Write-Host "  Cloudflared binary verified: $CfVer" -ForegroundColor Green

# WinSW 2.12.0 stable x64 binary
$WinSWExe = Join-Path $WinSWDir "WinSW-x64.exe"
if (-not (Test-Path $WinSWExe)) {
    Write-Host "[3/6] Staging WinSW 2.12.0 x64 binary..." -ForegroundColor Yellow
    curl.exe -Ls -o $WinSWExe "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe"
}
Write-Host "  WinSW service wrapper staged." -ForegroundColor Green

# Inno Setup 6.2.2 Compiler
$IsccExe = Join-Path $InnoDir "ISCC.exe"
if (-not (Test-Path $IsccExe)) {
    Write-Host "[4/6] Staging Inno Setup compiler..." -ForegroundColor Yellow
    $InnoZip = Join-Path $ToolsDir "innoextract.zip"
    $InnoExtractDir = Join-Path $ToolsDir "innoextract"
    if (-not (Test-Path (Join-Path $InnoExtractDir "innoextract.exe"))) {
        curl.exe -Ls -o $InnoZip "https://github.com/dscharrer/innoextract/releases/download/1.9/innoextract-1.9-windows.zip"
        Expand-Archive -Path $InnoZip -DestinationPath $InnoExtractDir -Force
    }
    $InnoInstaller = Join-Path $ToolsDir "innosetup-6.2.2.exe"
    if (-not (Test-Path $InnoInstaller)) {
        curl.exe -Ls -o $InnoInstaller "https://github.com/jrsoftware/issrc/releases/download/is-6_2_2/innosetup-6.2.2.exe"
    }
    & (Join-Path $InnoExtractDir "innoextract.exe") -d (Join-Path $ToolsDir "innosetup6") $InnoInstaller | Out-Null
}
Write-Host "  Inno Setup compiler verified: $IsccExe" -ForegroundColor Green

# ── 2. Build Next.js Production Standalone ────────────────────────────────────
if (-not $SkipBuild) {
    Write-Host "[5/6] Building Next.js production standalone server..." -ForegroundColor Yellow
    npm run build
}

# ── 3. Stage Standalone Static Assets ─────────────────────────────────────────
Write-Host "Staging static assets for standalone server..." -ForegroundColor Yellow
$StandaloneDir = Join-Path $ScriptDir ".next\standalone"
$StaticSrc = Join-Path $ScriptDir ".next\static"
$StaticDest = Join-Path $StandaloneDir ".next\static"
$PublicSrc = Join-Path $ScriptDir "public"
$PublicDest = Join-Path $StandaloneDir "public"

if (Test-Path $StaticSrc) {
    if (-not (Test-Path $StaticDest)) { New-Item -ItemType Directory -Path $StaticDest -Force | Out-Null }
    Copy-Item -Path "$StaticSrc\*" -Destination $StaticDest -Recurse -Force
}

if (Test-Path $PublicSrc) {
    if (-not (Test-Path $PublicDest)) { New-Item -ItemType Directory -Path $PublicDest -Force | Out-Null }
    Copy-Item -Path "$PublicSrc\*" -Destination $PublicDest -Recurse -Force
}

# Stage bcryptjs for offline bootstrap execution
$BcryptSrc = Join-Path $ScriptDir "node_modules\bcryptjs"
$BcryptDest = Join-Path $StandaloneDir "node_modules\bcryptjs"
if (Test-Path $BcryptSrc) {
    if (-not (Test-Path $BcryptDest)) { New-Item -ItemType Directory -Path $BcryptDest -Force | Out-Null }
    Copy-Item -Path "$BcryptSrc\*" -Destination $BcryptDest -Recurse -Force
}

# ── 4. Verify Critical Build Artifacts ─────────────────────────────────────────
$VerificationList = @(
    $NodeExe,
    $CloudflaredExe,
    $WinSWExe,
    $IsccExe,
    (Join-Path $ScriptDir "service\CallTrackTrainingApp.xml"),
    (Join-Path $ScriptDir "run-server.js"),
    (Join-Path $ScriptDir "cli\bootstrap.js"),
    (Join-Path $StandaloneDir "server.js"),
    (Join-Path $StandaloneDir "node_modules\.prisma\client\query_engine-windows.dll.node"),
    (Join-Path $StandaloneDir "node_modules\bcryptjs\package.json"),
    (Join-Path $ScriptDir "prisma\schema.prisma")
)

Write-Host "Verifying critical build artifacts..." -ForegroundColor Yellow
foreach ($artifact in $VerificationList) {
    if (-not (Test-Path $artifact)) {
        throw "CRITICAL ARTIFACT MISSING: $artifact"
    }
}
Write-Host "  All critical runtime and Prisma artifacts verified." -ForegroundColor Green

# ── 5. Compile Inno Setup Installer ───────────────────────────────────────────
Write-Host "[6/6] Compiling single-file Windows installer..." -ForegroundColor Yellow
$IssFile = Join-Path $ScriptDir "installer\CallTrackTraining.iss"
$OutputDir = Join-Path $ScriptDir "dist"
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }

& "$IsccExe" "/O$OutputDir" "/DMyAppVersion=$Version" "$IssFile"
if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup compilation failed with exit code $LASTEXITCODE"
}

$InstallerExe = Join-Path $OutputDir "CallTrackTraining-Setup-$Version.exe"
if (-not (Test-Path $InstallerExe)) {
    throw "BUILD FAILED: Expected installer executable not found at $InstallerExe"
}

$Hash = (Get-FileHash -Path $InstallerExe -Algorithm SHA256).Hash
$SizeMb = [math]::Round((Get-Item $InstallerExe).Length / 1MB, 2)

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "  INSTALLER BUILD SUCCEEDED!                                    " -ForegroundColor Green
Write-Host "  Artifact: $InstallerExe" -ForegroundColor White
Write-Host "  Size:     $SizeMb MB" -ForegroundColor White
Write-Host "  SHA256:   $Hash" -ForegroundColor White
Write-Host "=================================================================" -ForegroundColor Green
