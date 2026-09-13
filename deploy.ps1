# Automated Production Build & Deployment Script (PowerShell)
[CmdletBinding()]
param (
    [switch]$SkipTests = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " [DEPLOY] Starting Production Build & Setup Pipeline" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

Set-Location $ScriptDir

# 1. Type Check
Write-Host "`n>> [1/4] Running TypeScript Typecheck..." -ForegroundColor Yellow
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "TypeScript typecheck failed." }
Write-Host "✓ Typecheck passed." -ForegroundColor Green

# 2. Automated Test Suite
if (-not $SkipTests) {
    Write-Host "`n>> [2/4] Executing Test Suite..." -ForegroundColor Yellow
    npm test
    if ($LASTEXITCODE -ne 0) { throw "Test suite failed." }
    Write-Host "✓ All test suites passed." -ForegroundColor Green
} else {
    Write-Host "`n>> [2/4] Skipping tests (-SkipTests specified)." -ForegroundColor DarkGray
}

# 3. Production Build
Write-Host "`n>> [3/4] Compiling Production Bundles..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Production build failed." }
Write-Host "✓ Build completed." -ForegroundColor Green

# 4. Generate Production Config and Release Manifest
Write-Host "`n>> [4/4] Generating Release Configuration & Manifest..." -ForegroundColor Yellow
node scripts/deploy.js
if ($LASTEXITCODE -ne 0) { throw "Deployment manifest generation failed." }

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host " [DEPLOY] Production Pipeline Completed Successfully!" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
