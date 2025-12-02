# Configure Windows Firewall for MongoDB Security
# Run this in PowerShell as Administrator

Write-Host "MongoDB Firewall Configuration" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "✗ This script must be run as Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Running as Administrator" -ForegroundColor Green
Write-Host ""

# Create firewall rule to block external MongoDB access
Write-Host "Creating firewall rule to block external MongoDB access..." -ForegroundColor Yellow

try {
    # Remove existing rule if it exists
    Remove-NetFirewallRule -DisplayName "Block MongoDB External Access" -ErrorAction SilentlyContinue
    
    # Create new rule to block all external access to MongoDB port
    New-NetFirewallRule `
        -DisplayName "Block MongoDB External Access" `
        -Description "Blocks all external (non-localhost) connections to MongoDB port 27017 for security" `
        -Direction Inbound `
        -LocalPort 27017 `
        -Protocol TCP `
        -Action Block `
        -RemoteAddress Internet `
        -Enabled True `
        -Profile Any | Out-Null
    
    Write-Host "✓ Firewall rule created successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "MongoDB is now:" -ForegroundColor Cyan
    Write-Host "  ✓ Accessible from localhost (127.0.0.1)" -ForegroundColor Green
    Write-Host "  ✓ Accessible from local network (192.168.x.x)" -ForegroundColor Green
    Write-Host "  ✗ Blocked from internet access" -ForegroundColor Red
    Write-Host ""
    
} catch {
    Write-Host "✗ Failed to create firewall rule: $_" -ForegroundColor Red
    exit 1
}

# Verify the rule was created
Write-Host "Verifying firewall rule..." -ForegroundColor Yellow
$rule = Get-NetFirewallRule -DisplayName "Block MongoDB External Access" -ErrorAction SilentlyContinue

if ($rule) {
    Write-Host "✓ Firewall rule is active" -ForegroundColor Green
    Write-Host ""
    Write-Host "Rule Details:" -ForegroundColor Gray
    Write-Host "  Name: $($rule.DisplayName)" -ForegroundColor Gray
    Write-Host "  Enabled: $($rule.Enabled)" -ForegroundColor Gray
    Write-Host "  Action: Block external traffic to port 27017" -ForegroundColor Gray
} else {
    Write-Host "✗ Could not verify firewall rule" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Configuration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To verify MongoDB is still accessible locally:" -ForegroundColor Cyan
Write-Host "  mongosh mongodb://localhost:27017/harmonia" -ForegroundColor White
Write-Host ""
