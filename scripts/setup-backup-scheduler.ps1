#!/usr/bin/env pwsh
# Setup MongoDB automated backup with Windows Task Scheduler
# Run as Administrator

param(
    [string]$BackupTime = "02:00",
    [switch]$Remove
)

$ErrorActionPreference = "Stop"

$taskName = "Harmonia MongoDB Daily Backup"
$scriptPath = Join-Path $PSScriptRoot "backup-mongo.sh"
$repoRoot = Split-Path $PSScriptRoot -Parent

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Remove existing task if requested
if ($Remove) {
    Write-Host "🗑️  Removing scheduled backup task..." -ForegroundColor Yellow
    try {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
        Write-Host "✅ Backup task removed successfully" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  No existing task found" -ForegroundColor Yellow
    }
    exit 0
}

# Check if bash is available
$bashPath = Get-Command bash.exe -ErrorAction SilentlyContinue
if (-not $bashPath) {
    Write-Host "❌ bash.exe not found. Please install Git Bash or WSL" -ForegroundColor Red
    exit 1
}

# Check if backup script exists
if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ Backup script not found: $scriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "🔧 Setting up automated MongoDB backups..." -ForegroundColor Cyan
Write-Host "   Repository: $repoRoot" -ForegroundColor Gray
Write-Host "   Backup script: $scriptPath" -ForegroundColor Gray
Write-Host "   Schedule: Daily at $BackupTime" -ForegroundColor Gray

# Create scheduled task action
$action = New-ScheduledTaskAction `
    -Execute $bashPath.Source `
    -Argument "-c 'cd /c/repos/harmonia && ./scripts/backup-mongo.sh'" `
    -WorkingDirectory $repoRoot

# Create scheduled task trigger (daily at specified time)
$trigger = New-ScheduledTaskTrigger -Daily -At $BackupTime

# Create scheduled task settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

# Create scheduled task principal (run as current user)
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

# Remove existing task if it exists
try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
    Write-Host "   ℹ️  Removed existing task" -ForegroundColor Gray
} catch {
    # Task doesn't exist, continue
}

# Register the scheduled task
try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Daily MongoDB backup for Harmonia project using mongodump" `
        | Out-Null
    
    Write-Host ""
    Write-Host "✅ Automated backup configured successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Task Details:" -ForegroundColor Cyan
    Write-Host "   Name: $taskName" -ForegroundColor White
    Write-Host "   Schedule: Daily at $BackupTime" -ForegroundColor White
    Write-Host "   Retention: Last 7 days" -ForegroundColor White
    Write-Host "   Location: backups/mongo/" -ForegroundColor White
    Write-Host ""
    Write-Host "🔍 To verify:" -ForegroundColor Cyan
    Write-Host "   Get-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🧪 To test manually:" -ForegroundColor Cyan
    Write-Host "   Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🗑️  To remove:" -ForegroundColor Cyan
    Write-Host "   .\scripts\setup-backup-scheduler.ps1 -Remove" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host "❌ Failed to create scheduled task: $_" -ForegroundColor Red
    exit 1
}

# Test that Docker is running
try {
    $dockerStatus = docker ps --filter "name=harmonia-mongo-i9" --format "{{.Status}}" 2>&1
    if ($dockerStatus -like "*Up*") {
        Write-Host "✅ MongoDB container is running" -ForegroundColor Green
    } else {
        Write-Host "⚠️  MongoDB container is not running" -ForegroundColor Yellow
        Write-Host "   Start it with: docker compose up -d --wait mongo" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  Could not verify Docker status" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Ensure MongoDB container is running before backup time" -ForegroundColor White
Write-Host "   2. Verify .env file contains MONGO_ROOT_PASSWORD" -ForegroundColor White
Write-Host "   3. Test backup manually with: bash scripts/backup-mongo.sh" -ForegroundColor White
Write-Host ""
