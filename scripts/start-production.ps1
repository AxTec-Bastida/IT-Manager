param(
  [string]$ProjectRoot = "C:\Dev\warehouse-it-inventory",
  [int]$Port = 3000,
  [switch]$Build
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
  throw "Project root not found: $ProjectRoot"
}

Set-Location -LiteralPath $ProjectRoot
Write-Host "Warehouse IT Inventory production-like start"
Write-Host "Project root: $ProjectRoot"
Write-Host "Port: $Port"

npm.cmd run doctor

if ($Build) {
  npm.cmd run build
}

$env:PORT = [string]$Port
npm.cmd run start
