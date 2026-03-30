@echo off
set VENV_PATH=backend\venv
set PYTHON=%VENV_PATH%\Scripts\python.exe
set PIP=%VENV_PATH%\Scripts\pip.exe

echo [*] Using Virtual Environment: %VENV_PATH%

:: 1. Check if venv exists
if not exist "%PYTHON%" (
    echo [!] Virtual environment not found at %VENV_PATH%.
    echo Please make sure you have created it before running this.
    exit /b 1
)

:: 2. Install required comparison tools (if missing)
echo [*] Checking required dependencies (sshtunnel, paramiko)...
"%PIP%" install sshtunnel paramiko -q
if %ERRORLEVEL% neq 0 (
    echo [!] Failed to install dependencies.
    exit /b %ERRORLEVEL%
)

:: 3. Run the comparison tool
echo [*] Launching Database Comparison Tool...
"%PYTHON%" compare_db.py

echo.
pause