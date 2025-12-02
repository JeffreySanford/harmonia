@echo off
REM Simple MongoDB Shell installer for Windows
REM Run this as Administrator

echo.
echo MongoDB Shell (mongosh) Installer
echo ==================================
echo.

REM Check if mongosh is already installed
where mongosh >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] mongosh is already installed!
    mongosh --version
    echo.
    echo You can now run: .\scripts\connect-mongodb.ps1 -Setup
    pause
    exit /b 0
)

echo mongosh is not installed. Installing now...
echo.

REM Download URL for MongoDB Shell
set DOWNLOAD_URL=https://downloads.mongodb.com/compass/mongosh-2.3.7-x64.msi
set INSTALLER=%TEMP%\mongosh-installer.msi

echo Downloading MongoDB Shell...
powershell -Command "Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%INSTALLER%' -UseBasicParsing"

if not exist "%INSTALLER%" (
    echo.
    echo [ERROR] Download failed!
    echo.
    echo Please download manually from:
    echo https://www.mongodb.com/try/download/shell
    pause
    exit /b 1
)

echo.
echo [OK] Download complete
echo.
echo Installing MongoDB Shell...
echo (Installer window will open)
echo.

msiexec /i "%INSTALLER%" /qb

echo.
echo [OK] Installation complete
echo.
echo Cleaning up...
del "%INSTALLER%" >nul 2>&1

echo.
echo Refreshing environment...
echo.
echo Please close this window and open a NEW PowerShell Admin window.
echo Then run:
echo   cd C:\repos\harmonia
echo   .\scripts\connect-mongodb.ps1 -Test
echo.
pause
