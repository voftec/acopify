# =====================================================================
#  Acopify - build & deploy script
#  Usage:   .\deploy.ps1            # build CSS + deploy hosting only
#           .\deploy.ps1 -All       # build CSS + deploy hosting AND db rules
#           .\deploy.ps1 -Preview   # build CSS + deploy to a temp preview channel
#  Run from the project root (the folder containing firebase.json).
# =====================================================================
param(
    [switch]$All,
    [switch]$Preview
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

# 1. Ensure dependencies are installed -------------------------------
if (-not (Test-Path "node_modules")) {
    Step "Installing npm dependencies (first run)"
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
}

# 2. Build the Tailwind CSS ------------------------------------------
Step "Building Tailwind CSS"
npm run build:css
if ($LASTEXITCODE -ne 0) { throw "CSS build failed" }

$css = "public/assets/css/tailwind.css"
if (-not (Test-Path $css)) { throw "Expected output $css was not created" }
Write-Host ("Built {0} ({1:N0} bytes)" -f $css, (Get-Item $css).Length) -ForegroundColor Green

# 3. Deploy -----------------------------------------------------------
if ($Preview) {
    Step "Deploying to a temporary PREVIEW channel"
    npx firebase-tools hosting:channel:deploy preview
}
elseif ($All) {
    Step "Deploying hosting + database rules to production"
    npx firebase-tools deploy
}
else {
    Step "Deploying hosting to production"
    npx firebase-tools deploy --only hosting
}

if ($LASTEXITCODE -ne 0) { throw "Firebase deploy failed" }
Write-Host "`nDone." -ForegroundColor Green
