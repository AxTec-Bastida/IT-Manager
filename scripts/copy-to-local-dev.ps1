param(
  [string]$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$DestinationRoot = "C:\Dev\warehouse-it-inventory",
  [switch]$SkipGit,
  [switch]$IncludeBackups,
  [switch]$IncludeEnv,
  [switch]$WhatIfOnly
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) {
  Write-Host ""
  Write-Host $Message -ForegroundColor Cyan
}

if (-not (Test-Path -LiteralPath $SourceRoot)) {
  throw "Source path does not exist: $SourceRoot"
}

if ($SourceRoot -like "*OneDrive*" -or $SourceRoot -like "*SharePoint*") {
  Write-Warning "Source is inside a synced folder. This script copies out of it; do not run production from the synced source."
}

Write-Step "Preparing destination"
Write-Host "Source:      $SourceRoot"
Write-Host "Destination: $DestinationRoot"
New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null

$excludedDirectories = @(
  "node_modules",
  ".next",
  ".turbo",
  "out",
  "build",
  "coverage",
  ".vercel",
  ".cache",
  "logs"
)

if ($SkipGit) { $excludedDirectories += ".git" }
if (-not $IncludeBackups) { $excludedDirectories += (Join-Path $SourceRoot "backups") }

$excludedFiles = @(
  "*.log",
  "*.tmp",
  "*.temp",
  "*.tsbuildinfo",
  ".phase*.pid",
  "dev-server-*.log",
  "phase*-dev*.log",
  "phase*-dev*.out.log",
  "phase*-dev*.err.log"
)

if (-not $IncludeEnv) {
  $excludedFiles += ".env"
  $excludedFiles += ".env.local"
  $excludedFiles += ".env.development"
  $excludedFiles += ".env.production"
  $excludedFiles += ".env.test"
  $excludedFiles += ".env*.local"
}

if ($IncludeEnv) {
  Write-Warning ".env files may contain secrets. They will be copied, but values are never printed by this script."
} else {
  Write-Host ".env files are skipped. Copy .env manually if this is the active runtime folder."
}

Write-Step "Copying project files"
$robocopyArgs = @(
  $SourceRoot,
  $DestinationRoot,
  "/E",
  "/COPY:DAT",
  "/DCOPY:DAT",
  "/R:2",
  "/W:2",
  "/NP",
  "/NFL",
  "/NDL",
  "/XD"
) + $excludedDirectories + @("/XF") + $excludedFiles

if ($WhatIfOnly) {
  Write-Host "robocopy $($robocopyArgs -join ' ')"
  Write-Host "WhatIfOnly mode: no files copied."
  exit 0
}

& robocopy @robocopyArgs
$exitCode = $LASTEXITCODE
if ($exitCode -gt 7) {
  throw "Robocopy failed with exit code $exitCode"
}

Write-Step "Copy complete"
Write-Host "Robocopy exit code: $exitCode"
Write-Host "Next steps from destination:"
Write-Host "  cd $DestinationRoot"
Write-Host "  npm install"
Write-Host "  npx prisma generate"
Write-Host "  npm run doctor"
Write-Host "  npm test"
Write-Host "  npm run lint"
Write-Host "  npm run build"
Write-Host "  npm run backup"
