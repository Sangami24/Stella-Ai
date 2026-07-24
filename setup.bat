@echo off
echo ========================================
echo  STLA Guardian AI - Setup Script
echo  Team Falcons - Stellantis IGNITE
echo ========================================
echo.

echo [1/4] Installing backend dependencies...
cd /d "%~dp0backend"
call npm install
if errorlevel 1 (
    echo ERROR: Backend npm install failed!
    pause
    exit /b 1
)

echo.
echo [2/4] Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo ERROR: Frontend npm install failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Checking .env file...
cd /d "%~dp0backend"
if not exist ".env" (
    copy ".env.example" ".env"
    echo Created .env from .env.example
    echo IMPORTANT: Edit backend\.env and add your GEMINI_API_KEY!
) else (
    echo .env already exists
)

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo To start the app:
echo   Terminal 1: cd backend ^&^& npm run dev
echo   Terminal 2: cd frontend ^&^& npm run dev
echo.
echo Then open http://localhost:5173
echo.
pause
