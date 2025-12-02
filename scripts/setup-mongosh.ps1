# MongoDB Shell (mongosh) Installation Script
# Run this in PowerShell as Administrator

Write-Host "MongoDB Shell Setup for Windows" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if mongosh is already installed
$mongoshPath = Get-Command mongosh -ErrorAction SilentlyContinue

if ($mongoshPath) {
    Write-Host "✓ mongosh is already installed at: $($mongoshPath.Source)" -ForegroundColor Green
    & mongosh --version
    exit 0
}

Write-Host "mongosh is not installed. Installing now..." -ForegroundColor Yellow
Write-Host ""

# MongoDB Shell download URL (latest version)
$downloadUrl = "https://downloads.mongodb.com/compass/mongosh-2.3.7-x64.msi"
$installerPath = "$env:TEMP\mongosh-installer.msi"

Write-Host "Downloading MongoDB Shell..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "✓ Download complete" -ForegroundColor Green
} catch {
    Write-Host "✗ Download failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please download manually from:" -ForegroundColor Yellow
    Write-Host "https://www.mongodb.com/try/download/shell" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "Installing MongoDB Shell..." -ForegroundColor Yellow
Write-Host "(This will open the installer - follow the prompts)" -ForegroundColor Gray

try {
    Start-Process msiexec.exe -ArgumentList "/i `"$installerPath`" /qb" -Wait
    Write-Host "✓ Installation complete" -ForegroundColor Green
} catch {
    Write-Host "✗ Installation failed: $_" -ForegroundColor Red
    exit 1
}

# Clean up installer
Remove-Item $installerPath -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Verifying installation..." -ForegroundColor Yellow

# Refresh environment variables
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$mongoshPath = Get-Command mongosh -ErrorAction SilentlyContinue

if ($mongoshPath) {
    Write-Host "✓ mongosh installed successfully!" -ForegroundColor Green
    Write-Host ""
    & mongosh --version
    Write-Host ""
    Write-Host "You can now connect to MongoDB with:" -ForegroundColor Cyan
    Write-Host "  mongosh" -ForegroundColor White
    Write-Host ""
    Write-Host "Or connect to Harmonia database with:" -ForegroundColor Cyan
    Write-Host "  mongosh mongodb://localhost:27017/harmonia" -ForegroundColor White
} else {
    Write-Host "✗ Installation completed but mongosh not found in PATH" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please close and reopen PowerShell, then try again." -ForegroundColor Yellow
}
