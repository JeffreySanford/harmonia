# Enable MongoDB Authentication
# Run this in PowerShell as Administrator

Write-Host ""
Write-Host "MongoDB Authentication Enabler" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

$configPath = "C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg"

if (-not (Test-Path $configPath)) {
    Write-Host "ERROR: MongoDB config file not found at: $configPath" -ForegroundColor Red
    exit 1
}

Write-Host "Found MongoDB config: $configPath" -ForegroundColor Green
Write-Host ""

# Backup the config file
$backupPath = "$configPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $configPath $backupPath
Write-Host "Created backup: $backupPath" -ForegroundColor Green
Write-Host ""

# Read current config
$content = Get-Content $configPath -Raw

# Check if security section exists
if ($content -match "security:") {
    Write-Host "Security section already exists, updating..." -ForegroundColor Yellow
    # Update existing security section
    $content = $content -replace "(?m)^security:\s*$", "security:`n  authorization: enabled"
} else {
    Write-Host "Adding security section..." -ForegroundColor Yellow
    # Add security section after net section
    $content = $content -replace "(?m)(net:.*?(?=\r?\n[a-z]|\z))", "`$1`nsecurity:`n  authorization: enabled`n"
}

# Ensure bindIp is set to 127.0.0.1
if ($content -match "bindIp:") {
    if ($content -notmatch "bindIp:\s*127\.0\.0\.1") {
        Write-Host "Updating bindIp to 127.0.0.1..." -ForegroundColor Yellow
        $content = $content -replace "bindIp:.*", "bindIp: 127.0.0.1"
    }
} else {
    Write-Host "Adding bindIp setting..." -ForegroundColor Yellow
    $content = $content -replace "(?m)(net:)", "`$1`n  bindIp: 127.0.0.1"
}

# Write updated config
Set-Content $configPath $content -NoNewline

Write-Host ""
Write-Host "Configuration updated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "New security settings:" -ForegroundColor Cyan
Write-Host "  - bindIp: 127.0.0.1 (localhost only)" -ForegroundColor White
Write-Host "  - authorization: enabled (require authentication)" -ForegroundColor White
Write-Host ""

# Restart MongoDB service
Write-Host "Restarting MongoDB service..." -ForegroundColor Yellow
try {
    Restart-Service MongoDB -ErrorAction Stop
    Start-Sleep -Seconds 2
    $service = Get-Service MongoDB
    if ($service.Status -eq "Running") {
        Write-Host "MongoDB service restarted successfully!" -ForegroundColor Green
    } else {
        Write-Host "WARNING: MongoDB service status is: $($service.Status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: Failed to restart MongoDB service: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please restart manually:" -ForegroundColor Yellow
    Write-Host "  1. Open Services (Win+R, type: services.msc)" -ForegroundColor White
    Write-Host "  2. Find 'MongoDB' service" -ForegroundColor White
    Write-Host "  3. Right-click and select 'Restart'" -ForegroundColor White
}

Write-Host ""
Write-Host "Testing connection with authentication..." -ForegroundColor Yellow
Write-Host ""

# Test connection
$env:MONGO_URI = "mongodb://harmonia_app:vcd7VKCS3I+8jEC4EhdPKNKyowh0ikAE5GK5Jarn7yA=@localhost:27017/harmonia?authSource=harmonia"
$testResult = & mongosh $env:MONGO_URI --quiet --eval "db.runCommand({ping: 1})" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Authentication test PASSED!" -ForegroundColor Green
    Write-Host "MongoDB is now hardened and secure." -ForegroundColor Green
} else {
    Write-Host "Authentication test failed. This is normal if service is still starting." -ForegroundColor Yellow
    Write-Host "Wait 10 seconds and test manually:" -ForegroundColor Yellow
    Write-Host "  mongosh mongodb://harmonia_app:****@localhost:27017/harmonia" -ForegroundColor White
}

Write-Host ""
Write-Host "Hardening complete!" -ForegroundColor Green
Write-Host ""
