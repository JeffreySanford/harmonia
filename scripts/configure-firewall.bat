@echo off
REM Configure Windows Firewall for MongoDB Security
REM Run this as Administrator

echo.
echo MongoDB Firewall Configuration
echo ==============================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] This script must be run as Administrator!
    echo.
    echo Right-click and select "Run as Administrator"
    pause
    exit /b 1
)

echo [OK] Running as Administrator
echo.

REM Create firewall rule to block external MongoDB access
echo Creating firewall rule to block external MongoDB access...

REM Remove existing rule if it exists
netsh advfirewall firewall delete rule name="Block MongoDB External Access" >nul 2>&1

REM Create new rule to allow only localhost access to MongoDB port
netsh advfirewall firewall add rule name="MongoDB Allow Localhost Only" dir=in action=allow protocol=TCP localport=27017 remoteip=127.0.0.1 enable=yes

REM Block all other access to MongoDB port
netsh advfirewall firewall add rule name="Block MongoDB External Access" dir=in action=block protocol=TCP localport=27017 enable=yes

if %errorlevel% equ 0 (
    echo [OK] Firewall rule created successfully
    echo.
    echo MongoDB is now:
    echo   [OK] Accessible from localhost (127.0.0.1)
    echo   [OK] Accessible from local network
    echo   [X]  Blocked from internet access
    echo.
) else (
    echo [ERROR] Failed to create firewall rule
    pause
    exit /b 1
)

echo Configuration complete!
echo.
echo To verify MongoDB is still accessible locally:
echo   mongosh mongodb://localhost:27017/harmonia
echo.
pause
