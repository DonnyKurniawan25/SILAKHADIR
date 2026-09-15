@echo off
setlocal
title Silakhadir - Full Stack App

echo ============================================
echo    SILAKHADIR - Starting Application
echo ============================================
echo.

cd /d "%~dp0"

:: ----- Check prerequisites -----
where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python tidak ditemukan di PATH.
    echo         Install Python dari https://www.python.org/downloads/
    echo         dan centang "Add Python to PATH" saat instalasi.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js tidak ditemukan di PATH.
    echo         Install Node.js dari https://nodejs.org/
    pause
    exit /b 1
)

:: ----- Backend setup -----
echo [SETUP] Menyiapkan backend...

if not exist ".venv\Scripts\activate.bat" (
    echo   - Membuat virtual environment .venv ...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Gagal membuat virtual environment.
        pause
        exit /b 1
    )
)

call ".venv\Scripts\activate.bat"

:: Check if Django is already installed, if not, install dependencies
python -c "import django" >nul 2>nul
if errorlevel 1 (
    echo   - Menginstall dependency Python ...
    python -m pip install --upgrade pip >nul
    python -m pip install -r backend\requirements.txt
    if errorlevel 1 (
        echo [ERROR] Gagal menginstall dependency backend.
        pause
        exit /b 1
    )
)

if not exist "backend\.env" (
    echo   - Membuat backend\.env dari .env.example ...
    copy "backend\.env.example" "backend\.env" >nul
)

echo   - Menjalankan migrasi database ...
python backend\manage.py migrate

:: ----- Frontend setup -----
echo.
echo [SETUP] Menyiapkan frontend...

if not exist "frontend\.env" (
    echo   - Membuat frontend\.env dari .env.example ...
    copy "frontend\.env.example" "frontend\.env" >nul
)

if not exist "frontend\node_modules" (
    echo   - Menginstall dependency frontend npm install ...
    pushd frontend
    call npm install --no-audit --no-fund --legacy-peer-deps
    popd
    if errorlevel 1 (
        echo [ERROR] Gagal menginstall dependency frontend.
        pause
        exit /b 1
    )
)

echo.
echo ============================================
echo    Menjalankan Aplikasi...
echo ============================================

:: Start Backend (Django)
echo [1/2] Starting Backend (Django) on port 8000...
start "Silakhadir Backend" cmd /k "cd /d "%~dp0backend" && ..\.venv\Scripts\python.exe manage.py runserver"

:: Wait a moment for backend to initialize
ping 127.0.0.1 -n 4 >nul

:: Start Frontend (Vite + React)
echo [2/2] Starting Frontend (Vite) on port 5173...
start "Silakhadir Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ============================================
echo    Application Started!
echo ============================================
echo.
echo    Backend  : http://localhost:8000
echo    Frontend : http://localhost:5173
echo.
echo    Tutup jendela ini atau tekan tombol apa saja untuk keluar.
echo    (Backend dan Frontend tetap berjalan di jendela
echo     masing-masing)
echo ============================================
pause >nul
endlocal

