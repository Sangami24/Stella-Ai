@echo off
echo Starting STLA Guardian AI...
echo.

echo Starting Backend (port 3001)...
start "STLA Backend" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 2 /nobreak >nul

echo Starting Frontend (port 5173)...
start "STLA Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers starting...
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Open http://localhost:5173 in your browser
timeout /t 3
start http://localhost:5173
