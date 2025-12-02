@echo off
REM Simple MongoDB setup using JavaScript file
REM Run this as Administrator

echo.
echo Harmonia MongoDB Setup
echo ======================
echo.

REM Check if mongosh is installed
where mongosh >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] mongosh is not installed!
    echo.
    echo Run this first: .\scripts\install-mongosh.bat
    echo.
    pause
    exit /b 1
)

echo Running MongoDB setup script...
echo.

REM Run the JavaScript setup file
mongosh --quiet --file scripts\setup-mongodb.js

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] MongoDB setup complete!
    echo.
    echo Next steps:
    echo 1. Test connection: mongosh mongodb://localhost:27017/harmonia
    echo 2. Or with auth: mongosh mongodb://harmonia_app:password@localhost:27017/harmonia
    echo.
) else (
    echo.
    echo [ERROR] Setup failed!
    echo.
)

pause
