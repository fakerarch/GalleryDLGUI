@echo off
:: ============================================================
:: build.bat — Build gallery-dl GUI  (Windows NSIS + Portable)
:: Run this on a Windows machine with Node.js installed.
:: Produces:
::   dist\gallery-dl GUI Setup <version>.exe   (NSIS installer)
::   dist\gallery-dl-GUI-<version>-portable.exe (no-install portable)
:: ============================================================

echo.
echo =====================================================
echo   gallery-dl GUI  -- Windows Installer builder
echo =====================================================
echo.

:: ── 1. Check Node.js ──────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found.
    echo         Download from https://nodejs.org ^(LTS^)
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%i in ('node --version') do set NODE_VER=%%i
echo [OK] Node.js found: %NODE_VER%

:: ── 2. Install npm dependencies ────────────────────────────────
echo.
echo [*] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

:: ── 3. Build NSIS installer + portable ────────────────────────
echo.
echo [*] Building Windows NSIS installer and portable exe...
call npx electron-builder --win nsis portable --x64
if %errorlevel% neq 0 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

echo.
echo [OK] Build complete!  Check the dist\ folder.
echo.
dir /b dist\*.exe 2>nul
echo.
pause
