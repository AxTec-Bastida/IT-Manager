param(
  [string]$ProjectRoot = "C:\Dev\warehouse-it-inventory",
  [string]$TaskName = "Warehouse IT Inventory Jobs",
  [int]$IntervalMinutes = 15,
  [switch]$RunElevated
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
  throw "Project root not found: $ProjectRoot"
}

$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$logs = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$command = "cd /d `"$ProjectRoot`" && `"$npm`" run jobs:run-due >> logs\jobs-run-due.log 2>&1"
$action = New-ScheduledTaskAction -Execute "C:\Windows\System32\cmd.exe" -Argument "/c $command" -WorkingDirectory $ProjectRoot
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries -StartWhenAvailable
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$runLevel = if ($RunElevated) { "Highest" } else { "Limited" }
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel $runLevel

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Runs Warehouse IT Inventory scheduled reminder and health jobs." -Force | Out-Null

Write-Host "Registered Task Scheduler task: $TaskName"
Write-Host "Project root: $ProjectRoot"
Write-Host "Cadence: every $IntervalMinutes minute(s)"
Write-Host "Run level: $runLevel"
Write-Host "Log file: $logs\jobs-run-due.log"
Write-Host "If registration fails due to policy, open PowerShell as Administrator and run this script again with -RunElevated."
