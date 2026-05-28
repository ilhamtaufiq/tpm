@echo off
SETLOCAL EnableDelayedExpansion

:: ============================================
:: TPM Super App - Windows Build Script
:: ============================================

echo.
echo ========================================
echo   TPM Super App - Windows Build
echo ========================================
echo.

:: Configuration
set FRONTEND_DIR=c:\laragon\www\tpm\frontend
set DESKTOP_DIR=c:\laragon\www\tpm\desktop

:: Check if frontend directory exists
if not exist "%FRONTEND_DIR%" (
    echo ERROR: Frontend directory not found!
    echo Expected: %FRONTEND_DIR%
    pause
    exit /b 1
)

:: Step 1: Build Web Version
echo [1/5] Building Expo web version...
cd "%FRONTEND_DIR%"
call npx expo export:web

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Expo build failed!
    pause
    exit /b 1
)
echo ✓ Web build complete

:: Step 2: Create desktop directory if it doesn't exist
echo.
echo [2/5] Setting up desktop project...
if not exist "%DESKTOP_DIR%" (
    echo Creating desktop directory...
    mkdir "%DESKTOP_DIR%"
    
    :: Copy template files
    echo Copying template files...
    xcopy /E /I /Y "%~dp0desktop-template\*" "%DESKTOP_DIR%"
    
    echo ✓ Desktop project created
) else (
    echo ✓ Desktop directory exists
)

:: Step 3: Copy web build to desktop
echo.
echo [3/5] Copying web build to desktop project...
if exist "%FRONTEND_DIR%\web-build" (
    if exist "%DESKTOP_DIR%\build" (
        rmdir /s /q "%DESKTOP_DIR%\build"
    )
    xcopy /E /I /Y "%FRONTEND_DIR%\web-build" "%DESKTOP_DIR%\build"
    echo ✓ Files copied successfully
) else (
    echo ERROR: web-build directory not found!
    pause
    exit /b 1
)

:: Step 4: Install dependencies
echo.
echo [4/5] Installing dependencies...
cd "%DESKTOP_DIR%"

if not exist "node_modules" (
    echo Running npm install...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: npm install failed!
        pause
        exit /b 1
    )
    echo ✓ Dependencies installed
) else (
    echo ✓ Dependencies already installed
)

:: Step 5: Build Windows executable
echo.
echo [5/5] Building Windows executable...
echo This may take several minutes...
echo.

call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed!
    pause
    exit /b 1
)

:: Success!
echo.
echo ========================================
echo   BUILD COMPLETE! ✓
echo ========================================
echo.
echo Output files are in: %DESKTOP_DIR%\dist\
echo.

if exist "%DESKTOP_DIR%\dist" (
    echo Build artifacts:
    dir "%DESKTOP_DIR%\dist\*.exe" /b 2>nul
    echo.
    
    :: Show file sizes
    echo File sizes:
    for %%f in ("%DESKTOP_DIR%\dist\*.exe") do (
        set size=%%~zf
        set /a size_mb=!size! / 1048576
        echo   %%~nxf - !size_mb! MB
    )
)

echo.
echo Next steps:
echo 1. Test the installer: %DESKTOP_DIR%\dist\TPM-Super-App-Setup-*.exe
echo 2. Test the portable: %DESKTOP_DIR%\dist\TPM-Super-App-Portable-*.exe
echo 3. Distribute to users!
echo.
echo ========================================

pause
