# Connect to MongoDB and set up Harmonia database
# Run this after installing mongosh

param(
    [switch]$Setup,
    [switch]$Test
)

Write-Host "MongoDB Connection Script for Harmonia" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Check if mongosh is available
$mongoshPath = Get-Command mongosh -ErrorAction SilentlyContinue

if (-not $mongoshPath) {
    Write-Host "✗ mongosh is not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Run this first:" -ForegroundColor Yellow
    Write-Host "  .\scripts\setup-mongosh.ps1" -ForegroundColor White
    exit 1
}

# Load environment variables from .env
$envFile = ".\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.+)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "✓ Loaded .env file" -ForegroundColor Green
} else {
    Write-Host "✗ .env file not found" -ForegroundColor Red
    exit 1
}

$rootPassword = $env:MONGO_ROOT_PASSWORD
$appPassword = $env:MONGO_HARMONIA_PASSWORD

if (-not $rootPassword -or -not $appPassword) {
    Write-Host "✗ MongoDB passwords not found in .env" -ForegroundColor Red
    exit 1
}

Write-Host ""

if ($Test) {
    Write-Host "Testing MongoDB connection..." -ForegroundColor Yellow
    Write-Host ""
    
    # Test if authentication is enabled
    $testResult = & mongosh --quiet --eval "db.version()"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Connected to MongoDB successfully" -ForegroundColor Green
        Write-Host "  Version: $testResult" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Note: Authentication appears to be disabled" -ForegroundColor Yellow
        Write-Host "Run with -Setup flag to enable authentication:" -ForegroundColor Yellow
        Write-Host "  .\scripts\connect-mongodb.ps1 -Setup" -ForegroundColor White
    } else {
        Write-Host "✗ Connection failed" -ForegroundColor Red
        Write-Host $testResult -ForegroundColor Gray
    }
    exit 0
}

if ($Setup) {
    Write-Host "Setting up MongoDB authentication and Harmonia database..." -ForegroundColor Yellow
    Write-Host ""
    
    # Create setup script
    $setupScript = @"
// Switch to admin database
use admin

// Create root user (if not exists)
try {
    db.createUser({
        user: "admin",
        pwd: "$rootPassword",
        roles: ["root"]
    })
    print("✓ Created admin user")
} catch (e) {
    print("ℹ Admin user already exists")
}

// Switch to harmonia database
use harmonia

// Create application user (if not exists)
try {
    db.createUser({
        user: "harmonia_app",
        pwd: "$appPassword",
        roles: [
            { role: "readWrite", db: "harmonia" },
            { role: "dbAdmin", db: "harmonia" }
        ]
    })
    print("✓ Created harmonia_app user")
} catch (e) {
    print("ℹ harmonia_app user already exists")
}

// Create initial collections
db.createCollection("model_artifacts")
db.createCollection("licenses")
db.createCollection("inventory_versions")
db.createCollection("jobs")
db.createCollection("events")

print("")
print("✓ Harmonia database setup complete!")
print("")
print("Collections created:")
db.getCollectionNames().forEach(function(name) {
    print("  - " + name)
})
"@

    # Save script to temp file
    $tempScript = "$env:TEMP\harmonia-setup.js"
    $setupScript | Out-File -FilePath $tempScript -Encoding UTF8
    
    # Run setup script
    & mongosh --quiet --file $tempScript
    
    Remove-Item $tempScript -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "Setup complete! Test connection with:" -ForegroundColor Green
    Write-Host "  mongosh mongodb://harmonia_app:****@localhost:27017/harmonia" -ForegroundColor White
    Write-Host ""
    Write-Host "Note: You may need to enable authentication in MongoDB config" -ForegroundColor Yellow
    Write-Host "See: C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg" -ForegroundColor Gray
    
} else {
    Write-Host "Connecting to MongoDB..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Cyan
    Write-Host "  -Test     Test connection to MongoDB" -ForegroundColor White
    Write-Host "  -Setup    Set up authentication and Harmonia database" -ForegroundColor White
    Write-Host ""
    Write-Host "Example:" -ForegroundColor Gray
    Write-Host "  .\scripts\connect-mongodb.ps1 -Test" -ForegroundColor Gray
}
