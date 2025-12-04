# E2E Test Setup Script
# 
# Prepares test environment for E2E authentication tests
# - Creates test database
# - Seeds admin user
# - Cleans up test users from previous runs

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "E2E Test Environment Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Load environment variables
if (-Not (Test-Path ".env")) {
    Write-Host "Error: .env file not found" -ForegroundColor Red
    exit 1
}

# Parse .env file
$envVars = Get-Content ".env" | Where-Object { $_ -match '=' } | ForEach-Object {
    $parts = $_ -split '=', 2
    @{ Key = $parts[0]; Value = $parts[1] }
}

$mongoPassword = ($envVars | Where-Object { $_.Key -eq "MONGO_ROOT_PASSWORD" }).Value

if (-Not $mongoPassword) {
    Write-Host "Error: MONGO_ROOT_PASSWORD not found in .env" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Environment variables loaded" -ForegroundColor Green

# MongoDB connection
$mongoUri = "mongodb://admin:$mongoPassword@localhost:27017/harmonia_test?authSource=admin"

Write-Host ""
Write-Host "Step 1: Check MongoDB connection..." -ForegroundColor Yellow

try {
    $result = mongosh $mongoUri --quiet --eval "db.version()" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "MongoDB connection failed"
    }
    Write-Host "✓ MongoDB connected (version: $result)" -ForegroundColor Green
} catch {
    Write-Host "✗ MongoDB connection failed" -ForegroundColor Red
    Write-Host "  Make sure MongoDB is running: Get-Service MongoDB" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Step 2: Create test database..." -ForegroundColor Yellow

$createDbScript = @"
use harmonia_test;

// Drop existing test data
db.users.deleteMany({ email: /e2e.*@harmonia\.local/ });

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });

// Seed admin user (if not exists)
const adminExists = db.users.findOne({ email: 'admin@harmonia.local' });
if (!adminExists) {
    db.users.insertOne({
        username: 'admin',
        email: 'admin@harmonia.local',
        password: '\$2b\$10\$X3mZp0Y6YqJZ3xKfLm5bCO3fZnXz4Dw5vQ8Rk7Yj1Nv9Hf2Tk5Ue', // Hash for 'AdminP@ssw0rd!'
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    print('✓ Admin user created');
} else {
    print('✓ Admin user already exists');
}

print('✓ Test database ready');
"@

try {
    $result = $createDbScript | mongosh $mongoUri --quiet 2>&1
    Write-Host $result -ForegroundColor Gray
    Write-Host "✓ Test database configured" -ForegroundColor Green
} catch {
    Write-Host "✗ Database setup failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Verify setup..." -ForegroundColor Yellow

$verifyScript = @"
use harmonia_test;
const userCount = db.users.countDocuments();
const adminCount = db.users.countDocuments({ role: 'admin' });
print('Total users: ' + userCount);
print('Admin users: ' + adminCount);
"@

try {
    $result = $verifyScript | mongosh $mongoUri --quiet 2>&1
    Write-Host $result -ForegroundColor Gray
    Write-Host "✓ Setup verified" -ForegroundColor Green
} catch {
    Write-Host "✗ Verification failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "E2E Test Environment Ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test Database: harmonia_test" -ForegroundColor White
Write-Host "Admin User: admin@harmonia.local / AdminP@ssw0rd!" -ForegroundColor White
Write-Host ""
Write-Host "Run tests with:" -ForegroundColor Yellow
Write-Host "  pnpm test:e2e:auth" -ForegroundColor Cyan
Write-Host ""
