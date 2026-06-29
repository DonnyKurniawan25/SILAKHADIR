@echo off
title Silakhadir - Full Stack App

echo ============================================
echo    SILAKHADIR - Starting Application
echo ============================================
echo.

:: Start Backend (Django)
echo [1/2] Starting Backend (Django) on port 8000...
start "Silakhadir Backend" cmd /k "cd /d %~dp0 && .venv\Scripts\activate && cd backend && python manage.py runserver"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

:: Start Frontend (Vite + React)
echo [2/2] Starting Frontend (Vite) on port 5173...
start "Silakhadir Frontend" cmd /k "cd /d %~dp0 && cd frontend && npm run dev"

echo.
echo ============================================
echo    Application Started!
echo ============================================
echo.
echo    Backend  : http://localhost:8000
echo    Frontend : http://localhost:5173
echo.
echo    Close this window or press any key to exit.
echo    (Backend and Frontend will keep running in
echo     their own windows)
echo ============================================
pause >nul
