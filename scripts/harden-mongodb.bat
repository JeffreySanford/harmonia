@echo off
REM MongoDB Security Hardening Checker
REM Run this to verify MongoDB security configuration

echo.
echo MongoDB Security Hardening Check
echo =================================
echo.

REM Check if mongosh is installed
where mongosh >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] mongosh is not installed!
    pause
    exit /b 1
)

echo Running security audit...
echo.

REM Run the security check script
mongosh --quiet --file scripts\harden-mongodb.js

echo.
echo.
echo Do you want to update mongod.cfg to enforce authentication? (Y/N)
set /p RESPONSE="> "

if /i "%RESPONSE%"=="Y" (
    echo.
    echo Opening mongod.cfg location...
    echo Please manually verify these settings:
    echo.
    echo   net:
    echo     bindIp: 127.0.0.1
    echo     port: 27017
    echo   security:
    echo     authorization: enabled
    echo.
    explorer "C:\Program Files\MongoDB\Server\8.0\bin"
    echo.
    echo After editing mongod.cfg, restart MongoDB:
    echo   1. Open Services (services.msc)
    echo   2. Find "MongoDB" service
    echo   3. Right-click and select "Restart"
    echo.
)

pause
